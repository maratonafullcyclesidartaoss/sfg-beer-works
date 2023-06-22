import { check } from "k6";
import http from "k6/http";

const KONG_CLIENT = "kong";
const KONG_SECRET = "9aXao3F2bFMOmNqZYdXhzXE50GzjA7fc";
const USER = "maria";
const PASS = "maria";

export const options = {
  stages: [
    { target: 0, duration: "10s" },
    { target: 50, duration: "60s" },
    { target: 100, duration: "60s" },
    { target: 200, duration: "180s" },
  ],
};

function authenticateUsingKeycloak(clientId, clientSecret, username, pass) {
  const formData = {
    client_id: clientId,
    grant_type: "password",
    username: username,
    password: pass,
    client_secret: clientSecret,
    scope: "openid",
  };
  const headers = { "Content-Type": "application/x-www-form-urlencoded" };
  const response = http.post(
    "http://keycloak.iam/realms/brewery/protocol/openid-connect/token",
    formData,
    { headers }
  );
  return response.json();
}

export function setup() {
  return authenticateUsingKeycloak(KONG_CLIENT, KONG_SECRET, USER, PASS);
}

export default function (data) {
  const params = {
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${data.access_token}`, // or `Bearer ${clientAuthResp.access_token}`
    },
  };
  let response = http.get(
    "http://kong-kong-proxy.kong/beer-service/api/v1/beer",
    params
  );
  check(response, {
    "is status 200": (r) => r.status === 200,
  });
}
