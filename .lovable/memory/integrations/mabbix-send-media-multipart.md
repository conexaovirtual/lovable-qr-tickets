---
name: Mabbix Send Media Multipart
description: Mabbix/Whaticket /api/messages/send requires multipart/form-data with binary file in `medias` field for documents/images
type: feature
---
Mabbix API endpoint `POST /api/messages/send` only sends real media (PDF, image, etc.) when called as **multipart/form-data** with the binary file in the `medias` field. JSON variants (mediaUrl, medias[].url, dataURI in body, etc.) are silently treated as text and the file appears as a plain text message on WhatsApp.

**Correct pattern (Deno):**
```ts
const form = new FormData();
form.append("number", phone);
form.append("openTicket", "0");
form.append("queueId", "0");
form.append("body", caption || "");
form.append("medias", fileBlob, filename); // binary Blob, not URL

await fetch(`${MABBIX_BACKEND_URL}/api/messages/send`, {
  method: "POST",
  headers: { Authorization: `Bearer ${MABBIX_CONNECTION_TOKEN}` }, // do NOT set Content-Type
  body: form,
});
```

Used in `supabase/functions/waba-send/index.ts` for the `send_media` action.
