# Video research fallback log policy

For each supplied video, use the bounded chain: metadata, captions, thumbnail,
lawful preview/frame source, description, then an unavailable record. Never make
visual claims when the source is inaccessible and never disable TLS or use mirrors/
proxies to force acquisition. Earlier normal-TLS video failures are kept in the
existing research/qa logs.
