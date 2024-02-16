const qrcode = require("qrcode-terminal");
const { Client, LocalAuth } = require("whatsapp-web.js");

const client = new Client({
  authStrategy: new LocalAuth(),
});

client.on("qr", (qr) => {
  qrcode.generate(qr, { small: true });
});

client.on("ready", () => {
  console.log("Client is ready!");
    sendMessage();
});

client.on("message_create", async (message) => {
  console.log("Received message", message.body);
  if (message.body === "!ping") {
    await message.reply("pong");
  }
});

function sendMessage() {
  // Number where you want to send the message.
  const number = "+55279999999999";

  // Your message.
  const text = ".";

  // Getting chatId from the number.
  // we have to delete "+" from the beginning and add "@c.us" at the end of the number.
  const chatId = number.substring(1) + "@c.us";

  // Sending message.
  client.sendMessage(chatId, text);
}

client.initialize();
