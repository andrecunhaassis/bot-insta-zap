const express = require("express");
const http = require("http");
const socketIo = require("socket.io");
const qrcode = require("qrcode");
const { Client, LocalAuth, MessageMedia } = require("whatsapp-web.js");
const csv = require("csv-parser");
const { Readable } = require("stream");
const puppeteer = require("puppeteer");
const instaAuth = require("./secret/auth");

const app = express();
const server = http.createServer(app);
const io = socketIo(server);
const client = new Client({
  authStrategy: new LocalAuth(),
});
let whatsappReady = false;

app.use(express.static(__dirname));

client.on("qr", (qr) => {
  qrcode.toDataURL(qr, (err, url) => {
    if (err) {
      console.error("Erro ao gerar QR Code", err);
      return;
    }
    io.emit("qr", url);
  });
});

client.on("ready", () => {
  console.log("Client is ready!");
  io.emit("ready");
});

io.on("connection", (socket) => {
  console.log("a user connected: ", socket.id);
  if (whatsappReady) {
    io.emit("ready");
  }
  socket.on("processCSV", async (content) => {
    const results = [];
    const stream = Readable.from(content);
    stream
      .pipe(csv())
      .on("data", (data) => results.push(data))
      .on("end", async () => {
        const browser = await puppeteer.launch({
          headless: false,
          args: ["--no-sandbox", "--disable-setuid-sandbox"],
        });
        console.log(results);
        await loginToInstagram(browser);

        for (const row of results) {
          await checkAndSendMessages(row, browser);
        }
        socket.emit("messageStatus", "Processamento concluído");
      });
  });
});

async function checkAndSendMessages(row, browser) {
  const { phone, name, instagram, link } = row; // Corrigido de number para phone
  const hasLink = await checkInstagramProfile(instagram, browser);
  if (!hasLink) {
    const message = `Olá ${name}! Tudo bem? Aqui é a Assis, estava olhando seu perfil no Insta rs e vi que você ainda não colocou seu link da Assis lá! Adicionando o seu link do perfil ${link} você terá mais chances de receber oportunidades! 😍`;
    const chatId = phone.includes("@c.us")
      ? phone
      : phone.substring(1) + "@c.us";
    const imagePath = await takeScreenshot(instagram, browser);
    if (!imagePath) return;
    const media = MessageMedia.fromFilePath(imagePath);
    await client.sendMessage(chatId, media, { caption: message });
    await client.sendMessage(
      chatId,
      "Se precisar de ajuda para adicionar o link, estou à disposição! 😊"
    );
    await pedirOrcamento(browser, link);
  }
}

async function checkInstagramProfile(username, browser) {
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1366, height: 900 });
    await page.goto(`https://www.instagram.com/${username}/`, {
      waitUntil: "networkidle2",
    });
    // Ajuste o seletor abaixo conforme necessário para encontrar o link no perfil
    const link = await page.evaluate(() => {
      const element = document.querySelector('a[href*="app.assis.co"]');
      return element ? element.href : null;
    });

    console.log(`URL do perfil de ${username}: ${link}`);
    await page.close();
    return link && link.includes("app.assis.co");
  } catch (error) {
    console.error(`Erro ao verificar o perfil do Instagram: ${error}`);
    return false;
  }
}

async function delay(time) {
  return new Promise(function (resolve) {
    setTimeout(resolve, time);
  });
}

async function takeScreenshot(username, browser) {
  try {
    const page = await browser.newPage();

    await page.setViewport({
      width: 375,
      height: 812,
      deviceScaleFactor: 3,
      isMobile: true,
      hasTouch: true,
    });

    const url = `https://www.instagram.com/${username}/`;
    await page.goto(url);

    // Tenta aguardar o seletor por um tempo máximo especificado. Ajuste o timeout conforme necessário.
    await page.waitForSelector("._aa_y._aa_z", { timeout: 10000 }); // Reduz o timeout para 10 segundos
    await delay(2000);

    // Se o seletor for encontrado, continua para capturar a tela
    const imagePath = `./prints/${username}.png`; // Certifique-se de que a pasta prints exista
    await page.screenshot({ path: imagePath });
    return imagePath;
  } catch (error) {
    // Se o seletor não for encontrado dentro do tempo de espera, retorna null
    console.error(`Failed to take screenshot for ${username}: ${error}`);
    return null;
  }
}

async function pedirOrcamento(browser, link) {
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1366, height: 900 });
    await page.goto(`${link}/contato`, { waitUntil: "networkidle2" });

    await page.type(
      '[name="5652f1bf-103c-4d93-8a05-8afec1f2368f"]',
      "Pessoa teste"
    );
    await page.type(
      '[name="c9a465c0-cd38-4f96-a8b4-0a8ae1c7ec71"]',
      "27999997777"
    );

    // type submit to next part of form
    await page.click('[type="submit"]');

    await page.waitForSelector(
      'input[name="b22ca93d-94e4-4d70-b3e3-06e5db662cf6"]'
    );
    await page.type(
      'input[name="b22ca93d-94e4-4d70-b3e3-06e5db662cf6"]',
      "10/03/2024"
    );
    await page.type(
      'textarea[name="4469c9da-229c-4761-baaa-0623c992e5b9"]',
      "Fazer um site"
    );
    await page.type(
      'textarea[name="5cbee951-1b4d-465e-828b-df9ed787ba32"]',
      "Instagram"
    );

    await page.click('[type="submit"]');
    delay(1000);
    await page.click('[type="submit"]');
  } catch (error) {
    console.error(`Erro ao pedir orçamento: ${error}`);
  }
}

async function loginToInstagram(browser) {
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1366, height: 900 });
    await page.goto("https://www.instagram.com", {
      waitUntil: "networkidle2",
      timeout: 0,
    });

    console.log("Por favor, faça login no Instagram e feche a aba de login...");

    // Preencher os campos de email e senha
    await page.type('[name="username"]', instaAuth.email);
    await page.type('[name="password"]', instaAuth.password);

    // Clicar no botão de entrar
    // Substitua o seletor abaixo pelo seletor correto do seu botão de login, se necessário
    await page.click('button[type="submit"]');

    // Espera o usuário fazer login no Instagram
    await page.waitForNavigation({ waitUntil: "networkidle2" });

    console.log("Login bem-sucedido, continuando o script...");

    // Fecha a aba de login após o login ser confirmado
    await page.close();
  } catch (error) {
    console.error(`Erro ao fazer login no Instagram: ${error}`);
  }
}

client.initialize();

server.listen(3000, () => {
  console.log("Server running on http://localhost:3000");
});
