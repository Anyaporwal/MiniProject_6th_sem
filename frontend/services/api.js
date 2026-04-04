import axios from "axios";

const API = axios.create({
  baseURL: "http://127.0.0.1:8000/api/v1",
});

export const getHeatmap = (params) =>
  API.get("/risk/heatmap", { params });

export const getRoutes = (data) =>
  API.post("/routes/calculate", data);