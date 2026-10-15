import json
import logging
import os

from dotenv import load_dotenv
from fastapi import FastAPI, File, Form, Request, UploadFile
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, Response, StreamingResponse

from services.ai_service import (
    GEMINI_API_KEY,
    GEMINI_MODEL,
    cover_letter,
    customize,
    customize_events,
    resolve_resume_text,
)
from services.resume_service import (
    MAX_FILE_SIZE,
    MAX_JOB_DESCRIPTION_LENGTH,
    MAX_RESUME_TEXT_LENGTH,
    MEDIA_TYPES,
    MIN_JOB_DESCRIPTION_LENGTH,
    SECTIONS,
    AppError,
    ExportRequest,
    cover_letter_docx,
    cover_letter_pdf,
    export_filename,
    parse_resume,
    parse_sections,
    resume_docx,
    resume_pdf,
    validate_job_description,
)


load_dotenv()

CORS_ORIGINS = [
    origin.strip()
    for origin in os.getenv(
        "CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173"
    ).split(",")
    if origin.strip()
]

logger = logging.getLogger("uvicorn.error")


def to_ndjson(event: dict) -> bytes:
    return (json.dumps(event, ensure_ascii=False) + "\n").encode()

app = FastAPI(
    title="Resume Customizer API",
    version="2.0.0",
    description="Tailor resumes to job descriptions with Google Gemini.",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=False,
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
    expose_headers=["Content-Disposition"],
)


@app.exception_handler(AppError)
async def app_error_handler(request: Request, error: AppError):
    return JSONResponse(status_code=error.status_code, content={"detail": error.detail})

@app.exception_handler(RequestValidationError)
async def validation_error_handler(request: Request, error: RequestValidationError):
    problems = []
    for item in error.errors():
        field = ".".join(str(part) for part in item.get("loc", [])[1:]) or "request"
        problems.append(f"{field}: {item.get('msg', 'invalid value')}")
    return JSONResponse(status_code=422, content={"detail": "Invalid request - " + "; ".join(problems)})

@app.exception_handler(Exception)
async def unexpected_error_handler(request: Request, error: Exception):
    logger.error("Unexpected error on %s: %s", request.url.path, type(error).__name__)
    return JSONResponse(status_code=500, content={"detail": "Unexpected server error. Please try again."})

async def _read_upload(resume: UploadFile):
    content = await resume.read(MAX_FILE_SIZE + 1)
    return parse_resume(resume.filename or "", content)


@app.get("/api/health")
def health_check():
    return {
        "status": "ok",
        "ai_configured": bool(GEMINI_API_KEY),
        "model": GEMINI_MODEL,
        "limits": {
            "max_file_size": MAX_FILE_SIZE,
            "min_job_description_length": MIN_JOB_DESCRIPTION_LENGTH,
            "max_job_description_length": MAX_JOB_DESCRIPTION_LENGTH,
            "sections": list(SECTIONS),
        },
    }

@app.post("/api/extract-resume")
async def extract_resume(resume: UploadFile = File(...)):
    parsed = await _read_upload(resume)
    text = await resolve_resume_text(parsed)
    return {
        "filename": parsed.filename,
        "source": "scanned_pdf" if parsed.is_scanned_pdf else "text",
        "resume_text": text,
    }

@app.post("/api/customize-resume")
async def customize_resume(
    job_description: str = Form(""),
    resume: UploadFile = File(...),
    sections: str = Form(",".join(SECTIONS)),
):
    job_description = validate_job_description(job_description)
    selected = parse_sections(sections)
    parsed = await _read_upload(resume)
    return await customize(parsed, job_description, selected)

@app.post("/api/customize-resume/stream")
async def customize_resume_stream(
    job_description: str = Form(""),
    resume: UploadFile = File(...),
    sections: str = Form(",".join(SECTIONS)),
):
    job_description = validate_job_description(job_description)
    selected = parse_sections(sections)
    parsed = await _read_upload(resume)

    async def events():
        try:
            async for event in customize_events(parsed, job_description, selected):
                yield to_ndjson(event)
        except AppError as error:
            yield to_ndjson(
                {"type": "error", "status": error.status_code, "detail": error.detail}
            )
        except Exception as error:
            logger.error("Streaming customization failed: %s", type(error).__name__)
            yield to_ndjson(
                {"type": "error", "status": 500, "detail": "Unexpected server error. Please try again."}
            )

    return StreamingResponse(
        events(),
        media_type="application/x-ndjson",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )

@app.post("/api/cover-letter")
async def create_cover_letter(
    job_description: str = Form(""),
    resume: UploadFile | None = File(None),
    resume_text: str = Form(""),
):
    job_description = validate_job_description(job_description)

    if resume is not None:
        text = await resolve_resume_text(await _read_upload(resume))
    elif resume_text.strip():
        text = resume_text.strip()[:MAX_RESUME_TEXT_LENGTH]
    else:
        raise AppError(400, "Please upload your resume first.")

    return await cover_letter(text, job_description)

@app.post("/api/export")
def export_document(request: ExportRequest):
    if request.kind == "resume":
        if request.resume is None:
            raise AppError(400, "Resume content is required.")
        builder = resume_pdf if request.format == "pdf" else resume_docx
        content = builder(request.resume)
        name = request.name or request.resume.contact.name
    else:
        if request.cover_letter is None:
            raise AppError(400, "Cover letter content is required.")
        builder = cover_letter_pdf if request.format == "pdf" else cover_letter_docx
        content = builder(request.cover_letter)
        name = request.name or request.cover_letter.signature

    filename = export_filename(request.kind, request.format, name, request.company)
    return Response(
        content=content,
        media_type=MEDIA_TYPES[request.format],
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
