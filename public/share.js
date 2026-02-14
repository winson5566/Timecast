async function loadShared() {
  const id = window.location.pathname.split('/').pop();
  const resp = await fetch(`/api/podcasts/${id}`);
  const wrap = document.getElementById('shareContent');

  if (!resp.ok) {
    wrap.innerHTML = '<h2>Not found</h2><p>This shared podcast does not exist.</p>';
    return;
  }

  const data = await resp.json();
  wrap.innerHTML = `
    <h2>${data.title}</h2>
    <p class="meta">${data.input.startDate} ~ ${data.input.endDate} | ${data.input.region || 'Global'} | ${data.input.categories.join(', ')} | ${data.input.language}</p>
    <audio controls src="${data.audioUrl}"></audio>
    <h3>Summary</h3>
    <p>${data.summary || ''}</p>
    <h3>Script</h3>
    <pre>${data.scriptText || ''}</pre>
  `;
}

loadShared();
