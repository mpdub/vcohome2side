# VCO website prototype

A private preview of the VCO Registered Valuers website, the sideways version: on desktop each page is a row of full-screen slides, moved through with the menu, the arrow buttons, a mouse wheel, the arrow keys or a swipe; phones and short windows get a normal vertical page.

This site is encrypted and opens with a password. Pages and images are encrypted in the browser with AES-256-GCM; the key comes from the password (PBKDF2-SHA256). The editable source is kept privately and rebuilt from there.

Static HTML and CSS, self-hosted fonts, one bloom image per page, a few lines of JavaScript. No frameworks or build step on the page.
