(function () {
  var stored = localStorage.getItem('nammes-theme')
  var dark = stored ? stored === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches
  if (dark) document.documentElement.classList.add('dark')
})()
