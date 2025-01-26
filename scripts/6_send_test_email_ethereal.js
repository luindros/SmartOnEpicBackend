import nodemailer from 'nodemailer'

const transporter = nodemailer.createTransport({
    host: 'smtp.ethereal.email',
    port: 587,
    auth: {
        user: 'mozell47@ethereal.email',
        pass: '8wKbDjvBYN6jbG4nNT'
    }
});

transporter.sendMail({
  from: '"Luis Iglesias 👻" <luis@LIConsulting.com>', // sender address
  to: "luis_recepitent@LIConsulting.com", // list of receivers
  subject: "Hello from FHIR Bootcamp 🔥", // Subject line
  html: "Your Patient Camila Lopez is <b>completely fine</b>.<br/>Or <em>is she?</em>", // html body
}).then(info => console.log(info))