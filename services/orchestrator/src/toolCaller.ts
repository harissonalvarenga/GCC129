import axios from "axios";
import FormData from "form-data";

export async function callVisionService(
  imageBuffer: Buffer
) {

  const form = new FormData();

  form.append(
    "image",
    imageBuffer,
    "image.jpg"
  );

  const response = await axios.post(
    "http://vision-service:8004/analyze",
    form,
    {
      headers: form.getHeaders()
    }
  );

  return response.data;
}