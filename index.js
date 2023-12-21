require('dotenv').config();
const { ButtonBuilder, EmbedBuilder, ButtonStyle, CommandInteraction, AttachmentBuilder, REST, Routes } = require('discord.js');
const { createButtonRows, editButton, commands, emojis, sleep } = require('./utils.js');
const { startTime, chooseTimeout, timeBetweenRounds } = require('./config.json');
const { createWheel } = require('./wheel.js');
const Discord = require('discord.js');
const http = require('http');
http
  .createServer(function (req, res) {
    res.write("I'm alive");
    res.end();
  })
  .listen(8080);
const client = new Discord.Client({
  intents: [Discord.IntentsBitField.Flags.Guilds],
});

const Games = new Map();

client.on('ready', async () => {
  // Construct and prepare an instance of the REST module
  const rest = new REST().setToken(process.env.TOKEN);

  try {
    console.log(`Started refreshing ${commands.length} application (/) commands.`);

    // The put method is used to fully refresh all commands in the guild with the current set
    const data = await rest.put(Routes.applicationCommands(client.user.id), { body: commands });

    console.log(`Successfully reloaded ${data.length} application (/) commands.`);
  } catch (error) {
    // And of course, make sure you catch and log any errors!
    console.error(error);
  }

  console.log('I am ready!');
  console.log('Bot By Wick Studio');
});

client.on('interactionCreate', async (interaction) => {
  if (interaction.isCommand()) {
    if (interaction.commandName == 'roulette') {
      if (await Games.get(interaction.guildId)) {
        // Send a message indicating that a game is already running in this server
        interaction.reply({ content: 'There is already a game in progress in this server.', ephemeral: true });
        return;
      }
      const embed = new EmbedBuilder()
        .setTitle('Roulette')
        .setColor('#ccc666')
        .setDescription(`__**Players:**__\nNo players are participating in the game`)
        .addFields(
          {
            name: '__Player Instructions:__',
            value: `**1-** Join the game\n**2-** The first round will start, and a random player will be selected\n**3-** If you are the chosen player, you will select a player of your choice to be kicked from the game\n**4-** The player will be kicked, and a new round will start. When all players are kicked except for two, the wheel will spin, and the chosen player wins the game.`,
          },
          {
            name: '__Game Starts In__:',
            value: `**<t:${Math.floor((Date.now() + startTime * 1000) / 1000)}:R>**`,
          }
        );

      const buttons = Array.from(Array(20).keys()).map((i) =>
        new ButtonBuilder()
          .setCustomId(`join_${i + 1}_roulette`)
          .setStyle(ButtonStyle.Secondary)
          .setEmoji(emojis[i])
      );

      // New buttons
      const randomButton = new ButtonBuilder().setCustomId(`join_random_roulette`).setLabel('Join Randomly').setStyle(ButtonStyle.Success);

      const leaveButton = new ButtonBuilder().setCustomId(`leave_roulette`).setLabel('Leave the Game').setStyle(ButtonStyle.Danger);

      const rows = createButtonRows([...buttons, randomButton, leaveButton]);
      await interaction.reply({
        content: 'Starting Roulette Game',
        components: rows,
        embeds: [embed],
      });
      Games.set(interaction.guildID, { players: [] });
      const repliedMessage = await interaction.fetchReply();
      setTimeout(async () => {
        repliedMessage.embeds[0].fields[1].value = `\`\`\`Started\`\`\``;
        repliedMessage.edit({ components: [], embeds: [repliedMessage.embeds[0]] });
        startGame(interaction, true);
      }, startTime * 1000);
    }
  } else if (interaction.customId.startsWith('join')) {
    // Destructure the custom ID into separate variables
    var [, number] = interaction.customId.split('_');

    // Retrieve the saved game based on guild ID
    const savedGame = await Games.get(interaction.guildID);

    // If no game is found, send a reply indicating no game running in this server
    if (!savedGame) {
      interaction.reply({ content: 'No game is currently running in this server.', ephemeral: true });
      return;
    }

    // Check if the user has already joined the game
    if (savedGame.players.some((user) => user.user == interaction.user.id)) {
      interaction.reply({ content: 'You have already joined. Please leave before joining again.', ephemeral: true });
      return;
    }

    if (number == 'random') {
      // Get avalibe random button number
      do {
        number = Math.floor(Math.random() * 20) + 1;
      } while (savedGame.players.some((player) => player.buttonNumber == number));
    }

    if (savedGame.players.some((user) => user.buttonNumber === number)) {
      interaction.reply({ content: 'Number already taken, please try again.', ephemeral: true });
      return;
    }
    // Add the user to the game's players list with the corresponding button number
    savedGame.players.push({
      user: interaction.user.id,
      buttonNumber: number,
      username: interaction.user.username,
      avatar: interaction.user.displayAvatarURL({ size: 256, extension: 'png' }),
      color: interaction.user.hexAccentColor,
    });
    Games.set(interaction.guildId, savedGame);

    // Edit the button label and disable it with the user's username
    const updatedRow = editButton(interaction.message, savedGame.players);
    interaction.message.edit({ components: updatedRow.components });

    // Send a confirmation message indicating successful joining
    interaction.reply({ content: 'Joined successfully!', ephemeral: true });
  } else if (interaction.customId.startsWith('leave')) {
    // Retrieve the saved game based on guild ID
    const savedGame = await Games.get(interaction.guildID);

    // If no game is found, send a reply indicating no game running in this server
    if (!savedGame) {
      interaction.reply({ content: 'No game is currently running in this server.', ephemeral: true });
      return;
    }

    // Check if the user has not joined the game
    if (!savedGame.players.some((user) => user.user == interaction.user.id)) {
      interaction.reply({ content: 'You have not joined the game.', ephemeral: true });
      return;
    }

    // Find the user in the game and remove them from the players array
    const user = savedGame.players.find((user) => user.user == interaction.user.id);
    savedGame.players = savedGame.players.filter((user) => user.user != interaction.user.id);
    await Games.set(interaction.guildId, savedGame);

    // Edit the button label and disable it
    const updatedRow = editButton(interaction.message, savedGame.players, true, user);
    interaction.message.edit({ components: updatedRow.components });

    // Send a reply indicating successful leave
    interaction.reply({ content: 'You have left the game.', ephemeral: true });
  } else if (interaction.customId.startsWith('withdrawal')) {
    const savedGame = await Games.get(interaction.guildId);
    // If no game is found, send a reply indicating no game running in this server
    if (!savedGame) {
      interaction.reply({ content: 'No game is currently running in this server.', ephemeral: true });
      return;
    }

    if (interaction.user.id != savedGame?.winner.id) {
      // Send a message indicating that the user is not the winner
      interaction.reply({ content: 'You are not the winner of the game, so you cannot perform this action.', ephemeral: true });
      return;
    }
    if (Date.now() > savedGame.winner.until) {
      // Send a message indicating that the winner has missed their turn
      interaction.reply({ content: 'You have missed your turn.', ephemeral: true });
      return;
    }
    // Remove the user from the game
    savedGame.players = savedGame.players.filter((player) => player.user != interaction.user.id);
    savedGame.winner.id = '';

    await Games.set(interaction.guildId, savedGame);

    // Send a confirmation message that the user has withdrawn
    interaction.reply({ content: 'You have successfully withdrawn from the game.', ephemeral: true });
    interaction.channel.send(`💣 | <@${interaction.user.id}> has withdrawn from the game, the next round will start in a few seconds...`);

    // Start the next round of the game
    startGame(interaction);
  } else if (interaction.customId.startsWith('kick_')) {
    const [, kickedUser] = interaction.customId.split('_');

    const savedGame = await Games.get(interaction.guildId);
    // If no game is found, send a reply indicating no game running in this server
    if (!savedGame) {
      interaction.reply({ content: 'No game is currently running in this server.', ephemeral: true });
      return;
    }

    if (interaction.user.id != savedGame?.winner.id) {
      // Send a message indicating that the user is not the winner
      interaction.reply({ content: 'You are not the winner of the game, so you cannot kick players.', ephemeral: true });
      return;
    }
    if (Date.now() > savedGame.winner.until) {
      // Send a message indicating that the winner has missed their turn
      interaction.reply({ content: 'You have missed your turn.', ephemeral: true });
      return;
    }
    savedGame.players = savedGame.players.filter((player) => player.user != kickedUser);
    savedGame.winner.id = '';

    interaction.reply({ content: 'Player has been kicked from the game.', ephemeral: true });
    interaction.channel.send(`💣 | <@${kickedUser}> has been kicked from the game, the next round will start in a few seconds...`);
    startGame(interaction);
  }
});

/**
 * @param {CommandInteraction} interaction
 */
const startGame = async (interaction, start = false) => {
  const { players } = (await Games.get(interaction.guildId)) || { players: [] };
  if (players.length == 0) {
    await sleep(5);
    // Send a message indicating that the game has been canceled due to no players
    interaction.channel.send({ content: ':x: Game canceled: There are no players.' });
    return;
  }
  if (start) {
    await interaction.channel.send({
      content: `✅ | Numbers were distributed to each player. The first round will start in a few seconds...`,
    });
  }
  await sleep(timeBetweenRounds);
  const colorsGradient = ['#32517f', '#4876a3', '#5d8ec7', '#74a6eb', '#8ac0ff'];

  const options = players.map((user, index) => ({
    user: user,
    label: user.username,
    color: colorsGradient[index % colorsGradient.length],
  }));

  const winnerOption = options[Math.floor(Math.random() * options.length)];
  const winnerIndex = options.indexOf(winnerOption);
  options[winnerIndex] = {
    ...winnerOption,
    winner: true,
  };

  const savedData = await Games.get(interaction.guildId);
  const time = Date.now() + chooseTimeout * 1000;
  savedData.winner = { id: winnerOption.user.user, until: time };
  await Games.set(interaction.guildId, savedData);
  const image = await createWheel(options, winnerOption.user.avatar);

  const buttons = players
    .filter((user) => user.username != winnerOption.label)
    .map((user) =>
      new ButtonBuilder()
        .setCustomId(`kick_${user.user}`)
        .setStyle(ButtonStyle.Secondary)
        .setLabel(user.username)
        .setEmoji(emojis[Number(user.buttonNumber) - 1])
    );

  const leaveButton = new ButtonBuilder().setCustomId(`withdrawal`).setLabel('Withdrawal').setStyle(ButtonStyle.Danger);

  const rows = createButtonRows([...buttons, leaveButton]);

  const attachment = new AttachmentBuilder(image, { name: 'wheel.png' });

  if (players.length <= 2) {
    const embed = new EmbedBuilder()
      .setImage('attachment://wheel.png')
      .setColor('#4876a3')
      .setDescription(`**:crown: This is the last round! The chosen player is the winning player of the game.**`);
    await interaction.channel.send({
      content: `**${winnerOption.user.buttonNumber} - <@${winnerOption.user.user}> **`,
      embeds: [embed],
      files: [attachment],
    });
    await Games.delete(interaction.guildId);
  } else {
    const embed = new EmbedBuilder()
      .setImage('attachment://wheel.png')
      .setColor('#4876a3')
      .setDescription(`**⏰ | You have ${chooseTimeout} seconds to choose a player to send off**`);
    await interaction.channel.send({
      content: `**${winnerOption.user.buttonNumber} - <@${winnerOption.user.user}> **`,
      embeds: [embed],
      files: [attachment],
      components: rows,
    });
    setTimeout(async () => {
      const checkUser = await Games.get(interaction.guildId);
      if (checkUser?.winner.id == winnerOption.user.user && checkUser.winner.until == time) {
        checkUser.players = checkUser.players.filter((player) => player.user != winnerOption.user.user);
        checkUser.winner.id = '';

        // Update the game state after removing the user
        await Games.set(interaction.guildId, checkUser);

        // Send a message to the channel indicating that the user has been kicked for timeout
        interaction.channel.send(
          `⏰ | <@${winnerOption.user.user}> has been kicked from the game due to timeout. The next round will start shortly...`
        );

        // Start the next round of the game
        startGame(interaction);
      }
    }, chooseTimeout * 1000);
  }
};

client.login(process.env.TOKEN);
