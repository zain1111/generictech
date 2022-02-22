// Replace if using a different env file or config
require("dotenv").config({ path: "./.env" });
const nodemailer = require("nodemailer");
const smtpTransport = require("nodemailer-smtp-transport");
const express = require("express");
const Cors = require("cors");
const app = express();
const path = require("path");
const { resolve } = require("path");
const bodyParser = require("body-parser");
const hbs = require("nodemailer-express-handlebars");
const { engine } = require("express-handlebars");
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
let PORT = process.env.PORT || 4242;
app.use(Cors());
app.use(bodyParser.json());
app.use(express.static("public"));

app.engine(
  "handlebars",
  engine({
    extname: "hbs",
    defaultLayout: "",
    layoutsDir: "",
  })
);
app.set("view engine", "handlebars");
const transporter = nodemailer.createTransport(
  smtpTransport({
    service: "gmail",
    auth: {
      user: process.env.NODEMAILER_USER,
      pass: process.env.NODEMAILER_PASS,
    },
    secure: false,
  })
);

const handlebarOptions = {
  viewEngine: {
    extName: ".handlebars",
    partialsDir: path.resolve(__dirname, "views"),
    defaultLayout: false,
  },
  viewPath: path.resolve(__dirname, "views"),
  extName: ".handlebars",
};
transporter.use("compile", hbs(handlebarOptions));

// const userDetails = {
//   name: "Faraz",
//   email: "kingofheart1pk@gmail.com",
//   address: "New street mohala islamia higher scondary school",
//   city: "Jhelum",
//   state: "Islamabad",
//   zip: "49600",
//   country: "Pakistan",
// };
// const cardDetails = {
//   cardName: "Faraz Ahmed",
//   cardNumber: "1234 1234 1234 1234",
//   cardExpiry: "12/06",
//   cardCode: "123",
//   chip: "big",
//   card: "golden",
// };
// app.get("/", (req, res) => {
//   let cardImage = {};
//   if (cardDetails.card === "golden") {
//     switch (cardDetails.chip) {
//       case "big":
//         cardImage.front = "gold_lChip.png";
//         cardImage.back = "gold_back.png";
//         break;
//       case "small":
//         cardImage.front = "gold_sChip.png";
//         cardImage.back = "gold_back.png";
//         break;
//     }
//   } else if (cardDetails.card === "sliver") {
//     switch (cardDetails.chip) {
//       case "big":
//         cardImage.front = "silver_lChip.png";
//         cardImage.back = "silver_back.png";
//         break;
//       case "small":
//         cardImage.front = "silver_sChip.png";
//         cardImage.back = "silver_back.png";
//         break;
//     }
//   }
//   res.render("order", { userDetails, cardImage, cardDetails });
// });

app.use((req, res, next) => {
  if (req.originalUrl === "/webhook") {
    next();
  } else {
    bodyParser.json()(req, res, next);
  }
});

app.post("/create-payment-intent", async (req, res) => {
  // res.set('Access-Control-Allow-Origin', '*');
  const { paymentMethodType, currency, amount, cardDetails, userDetails } =
    req.body;
  console.log(cardDetails, userDetails);
  try {
    const paymentIntent = await stripe.paymentIntents.create({
      amount: amount,
      currency: currency,
      payment_method_types: [paymentMethodType],
      description: "Invoice# " + new Date().getTime().toString(10),
    });
    res.json({ clientSecret: paymentIntent.client_secret });
    const invoice = paymentIntent.description;
    // Send email after payment
    let cardImage = {};
    if (cardDetails.card === "golden") {
      switch (cardDetails.chip) {
        case "big":
          cardImage.front = "gold_lChip.png";
          cardImage.back = "gold_back.png";
          break;
        case "small":
          cardImage.front = "gold_sChip.png";
          cardImage.back = "gold_back.png";
          break;
      }
    } else if (cardDetails.card === "silver") {
      switch (cardDetails.chip) {
        case "big":
          cardImage.front = "silver_lChip.png";
          cardImage.back = "silver_back.png";
          break;
        case "small":
          cardImage.front = "silver_sChip.png";
          cardImage.back = "silver_back.png";
          break;
      }
    }
    const optionsClient = {
      from: process.env.NODEMAILER_USER,
      to: userDetails.email,
      subject: "Swipemint Order",
      text: "You have placed and order at Swipemint",
      template: "receipt",
      attachments: [
        {
          filename: "logo.png",
          path: __dirname + "/public/logo.png",
          cid: "logo",
          contentDisposition: "inline",
        },
        {
          filename: cardImage.front,
          path: __dirname + "/public/cards/" + cardImage.front,
          cid: "cardFront",
          contentDisposition: "inline",
        },
        {
          filename: cardImage.back,
          path: __dirname + "/public/cards/" + cardImage.back,
          cid: "cardBack",
          contentDisposition: "inline",
        },
        {
          filename: "email.png",
          path: __dirname + "/public/email.png",
          cid: "emailLogo",
          contentDisposition: "inline",
        },
      ],
      context: {
        userDetails,
        cardDetails,
        cardImage,
        invoice,
      },
    };
    const optionsAdmin = {
      from: process.env.NODEMAILER_USER,
      to: process.env.NODEMAILER_RECEIVER,
      subject: "Swipemint Order",
      text: "You have recieved an order",
      template: "order",
      context: {
        userDetails,
        cardDetails,
        cardImage,
        invoice,
      },
      attachments: [
        {
          filename: cardImage.front,
          path: __dirname + "/public/cards/" + cardImage.front,
          cid: "cardFront",
          contentDisposition: "inline",
        },
        {
          filename: cardImage.back,
          path: __dirname + "/public/cards/" + cardImage.back,
          cid: "cardBack",
          contentDisposition: "inline",
        },
      ],
    };
    transporter.sendMail(optionsClient, function (err, info) {
      if (err) {
        console.log(err);
        return;
      }
      console.log("Sent " + info.response);
    });
    transporter.sendMail(optionsAdmin, function (err, info) {
      if (err) {
        console.log(err);
        return;
      }
      console.log("Sent " + info.response);
    });
  } catch (e) {
    res.status(400).json({ error: { message: e.message } });
  }
});
app.get("/config", async (req, res) => {
  res.json({ publishableKey: process.env.STRIPE_PUBLISHABLE_KEY });
});
app.get("/", (req, res) => {
  const path = resolve(process.env.STATIC_DIR + "/index.html");
  res.sendFile(path);
});

// Stripe requires the raw body to construct the event
app.post(
  "/webhook",
  bodyParser.raw({ type: "application/json" }),
  (req, res) => {
    const sig = req.headers["stripe-signature"];

    let event;

    try {
      event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
    } catch (err) {
      // On error, log and return the error message
      console.log(`❌ Error message: ${err.message}`);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    // Successfully constructed event
    if (event.type === "payment_intent_created") {
      console.log("paymentIntent created!");
    }
    console.log("✅ Success:", event.id);

    // Return a response to acknowledge receipt of the event
    res.json({ received: true });
  }
);

app.listen(PORT, () => console.log(`Node server listening on port ${PORT}!`));
