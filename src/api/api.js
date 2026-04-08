import axios from "axios";

const API = axios.create({
  baseURL: "http://127.0.0.1:8000",
});

export const detectDeepfake = async (file) => {
  const formData = new FormData();
  formData.append("file", file);

  const response = await API.post("/detect", formData, {
    headers: {
      "Content-Type": "multipart/form-data",
    },
  });

  return response.data;
};