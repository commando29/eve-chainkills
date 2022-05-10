import queryString from "query-string";
import settings from "../settings";

const websocketClient = (options = {}, onConnect = null) => {
  let url = options.url;

  let subscribeParams =  {"action":"sub","channel":"killstream"};

  if (options.queryParams) {
    url = `${url}?${queryString.stringify(options.queryParams)}`;
  }
s
  let client = new WebSocket(url);

  client.addEventListener("open", () => {
    client.send(JSON.stringify(subscribeParams));
    console.log(`[websockets] Connected to ${url}`);
  });

  client.addEventListener("close", () => {
    console.log(`[websockets] Disconnected from ${url}`);
    client = null;
  });

  client.addEventListener("message", (event) => {
    if (event?.data && options.onMessage) {
      options.onMessage(JSON.parse(event.data));
    }
  });

  const connection = {
    client,
    send: (message = {}) => {
      if (options.queryParams) {
        message = { ...message, ...options.queryParams };
      }

      return client.send(JSON.stringify(message));
    },
  };

  return connection;
};

export default websocketClient;