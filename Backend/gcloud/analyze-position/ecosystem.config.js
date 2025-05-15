module.exports = {
  apps : [{
    name   : "enpassant-gemini",
    script : "./gemini-server.js",
    env: {
      NODE_ENV: "production", // Or "development"
      PORT: 8081,
      GOOGLE_CLOUD_PROJECT: "enpassant-459102"
    }
  }]
}