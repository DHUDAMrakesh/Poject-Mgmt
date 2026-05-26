import axios from "axios";

export const API_BASE_URL = (import.meta.env.VITE_BASEURL || "").replace(
  /\/$/,
  "",
);

const api = axios.create({
  baseURL: API_BASE_URL || undefined,
});

export default api;
