const API_URL = import.meta.env.VITE_API_URL || ''

async function errorMessage(response) {
  const data = await response.json().catch(() => ({}))
  if (typeof data.detail === 'string') return data.detail
  if (response.status >= 500) {
    return 'The server is unavailable. Please make sure the backend is running.'
  }
  return 'Something went wrong. Please try again.'
}

async function request(path, options) {
  let response
  try {
    response = await fetch(`${API_URL}${path}`, options)
  } catch (error) {
    if (error.name === 'AbortError') throw error
    throw new Error('Unable to connect to the backend. Please try again.', { cause: error })
  }
  if (!response.ok) throw new Error(await errorMessage(response))
  return response
}

export async function customizeResume({ jobDescription, resume, sections }, onEvent, signal) {
  const formData = new FormData()
  formData.append('job_description', jobDescription)
  formData.append('resume', resume)
  formData.append('sections', sections.join(','))

  const response = await request('/api/customize-resume/stream', {
    method: 'POST',
    body: formData,
    signal,
  })

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })

    const lines = buffer.split('\n')
    buffer = lines.pop()

    for (const line of lines) {
      if (!line.trim()) continue
      const event = JSON.parse(line)
      if (event.type === 'result') return event.data
      if (event.type === 'error') throw new Error(event.detail)
      onEvent(event)
    }
  }

  throw new Error('The connection closed before the result arrived. Please try again.')
}

export async function generateCoverLetter({ jobDescription, resume, resumeText }, signal) {
  const formData = new FormData()
  formData.append('job_description', jobDescription)
  if (resumeText) formData.append('resume_text', resumeText)
  else formData.append('resume', resume)

  const response = await request('/api/cover-letter', {
    method: 'POST',
    body: formData,
    signal,
  })
  return response.json()
}

export async function downloadDocument(payload) {
  const response = await request('/api/export', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })

  const disposition = response.headers.get('Content-Disposition') || ''
  const filename =
    disposition.match(/filename="([^"]+)"/)?.[1] || `document.${payload.format}`

  const url = URL.createObjectURL(await response.blob())
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
  return filename
}
