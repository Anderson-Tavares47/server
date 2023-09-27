const express = require("express");
const mysql = require("mysql");
const cors = require("cors"); // Importe o pacote cors
const bodyParser = require("body-parser");
const moment = require("moment-timezone");

const app = express();
const PORT = process.env.PORT || 3001; // Escolha a porta que deseja usar

app.use(cors());

// Use o middleware body-parser para analisar o corpo das solicitações
app.use(bodyParser.json()); // Configuração para analisar JSON

// Configuração da conexão com o MySQL
const db = mysql.createConnection({
  host: "user-database.c5jsdzkcdnmx.us-east-1.rds.amazonaws.com",
  user: "admin",
  password: "teste12345",
  database: "system_login",
});

db.connect((err) => {
  if (err) {
    console.error("Erro ao conectar ao MySQL:", err);
  } else {
    console.log("Conexão com o MySQL estabelecida com sucesso");
  }
});

app.post("/api/Register", async (req, res) => {
  const { username, company, password, currentUser } = req.body;

  // Verifica se o usuário já existe no banco de dados
  const userExistsQuery = "SELECT * FROM users WHERE username = ?";
  db.query(userExistsQuery, [username], async (err, results) => {
    if (err) {
      console.error("Erro ao verificar o usuário:", err);
      return res.status(500).json({ message: "Erro interno do servidor" });
    }

    if (results.length > 0) {
      return res
        .status(400)
        .json({ message: "Este nome de usuário já está em uso" });
    }

    // Se o usuário não existir, crie a conta
    const bcrypt = require("bcrypt");
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    const createUserQuery =
      "INSERT INTO users (username, company, password, currentUser) VALUES (?, ?, ?, ?)";
    db.query(
      createUserQuery,
      [username, company, hashedPassword, currentUser],
      (err) => {
        if (err) {
          console.error("Erro ao criar a conta:", err);
          return res.status(500).json({ message: "Erro ao criar a conta" });
        }

        // Registro bem-sucedido
        return res.status(200).json({ message: "Conta criada com sucesso" });
      }
    );
  });
});

app.post("/api/login", async (req, res) => {
  const { username, password, latitude, longitude } = req.body;

  // Verifique se o email e a senha são fornecidos
  if (!username || !password) {
    return res
      .status(400)
      .json({ message: "Nome de usuário e senha são obrigatórios" });
  }

  // Consulta SQL para verificar se o usuário com o nome de usuário fornecido existe no banco de dados
  const loginQuery = "SELECT * FROM users WHERE username = ?";
  db.query(loginQuery, [username], async (err, results) => {
    if (err) {
      console.error("Erro ao verificar o login:", err);
      return res.status(500).json({ message: "Erro interno do servidor" });
    }

    // Verifique se o usuário foi encontrado
    if (results.length === 0) {
      return res.status(401).json({ message: "Credenciais inválidas" });
    }

    // Compare a senha fornecida com a senha armazenada no banco de dados
    const bcrypt = require("bcrypt");
    const match = await bcrypt.compare(password, results[0].password);

    if (!match) {
      return res.status(404).json({ message: "Credenciais inválidas" });
    }

    // Verifique se o currentUser é "Admin"
    if (results[0].currentUser !== "Admin" && results[0].currentUser !== 'AdminMaster') {
      // Recupere o valor atual do campo previous_coordinates
      const previousCoordinates = JSON.parse(
        results[0].previous_coordinates || "[]"
      );

      // Defina o fuso horário para 'America/Sao_Paulo'
      moment.tz.setDefault("America/Sao_Paulo");

      // Crie uma data com o fuso horário correto
      const data = moment();

      // Formate a data conforme necessário
      const dataFormatada = data.format("YYYY-MM-DD HH:mm:ss");

      // Adicione um novo objeto com as coordenadas e o horário atual
      previousCoordinates.push({
        latitude,
        longitude,
        timestamp: dataFormatada,
      });

      // Atualize o campo previous_coordinates na tabela do usuário correspondente
      const updateCoordinatesQuery =
        "UPDATE users SET previous_coordinates = ? WHERE username = ?";
      db.query(
        updateCoordinatesQuery,
        [JSON.stringify(previousCoordinates), username],
        (err) => {
          if (err) {
            console.error("Erro ao atualizar previous_coordinates:", err);
            return res.status(500).json({ message: "Erro interno do servidor" });
          }

          // Login bem-sucedido
          return res.status(200).json({ message: "Login bem-sucedido" });
        }
      );
    } else {
      // Se o currentUser não for "Admin", apenas retorne um login bem-sucedido
      return res.status(200).json({ message: "Login bem-sucedido" });
    }
  });
});


app.get("/api/user/:username", (req, res) => {
  const { username } = req.params;

  // Consulta SQL para buscar as informações do usuário com base no nome de usuário
  const getUserQuery =
    "SELECT username, company, currentUser, previous_coordinates  FROM users WHERE username = ?";

  db.query(getUserQuery, [username], (err, results) => {
    if (err) {
      console.error("Erro ao buscar informações do usuário:", err);
      return res.status(500).json({ message: "Erro interno do servidor" });
    }

    if (results.length === 0) {
      return res.status(404).json({ message: "Usuário não encontrado" });
    }

    // Retorna as informações do usuário encontradas no banco de dados
    const user = results[0];
    return res.status(200).json({ user });
  });
});




app.listen(PORT, () => {
  console.log(`Servidor em execução na porta ${PORT}`);
});
