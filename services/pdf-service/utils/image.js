function decodeBase64Image(dataString) {
  const matches = dataString.match(/^data:image\/png;base64,(.+)$/);
  if (!matches || matches.length !== 2) return null;
  return Buffer.from(matches[1], 'base64');
}

module.exports = { decodeBase64Image };
