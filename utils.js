const { ActionRowBuilder, Message } = require('discord.js');
const emojis = [
  '1️⃣',
  '2️⃣',
  '3️⃣',
  '4️⃣',
  '5️⃣',
  '6️⃣',
  '7️⃣',
  '8️⃣',
  '9️⃣',
  '🔟',
  '<:eleven:989246551077564436>',
  '<:twelve:989246551929008200>',
  '<:thirteen:989246553451532340>',
  '<:fourteen:989246554529464400>',
  '<:fifteen:989246544370888754>',
  '<:sixteen:989246545281052724>',
  '<:seventeen:989246546644197406>',
  '<:eighteen:989246547873124442>',
  '<:nineteen:989246548904915034>',
  '<:twenty:989246550100279408>',
];

const commands = [
  {
    name: 'roulette',
    description: 'roulette Game',
    options: [],
  },
];

function createButtonRows(buttons) {
  const rows = [];
  let index = 0;

  while (index < buttons.length) {
    const row = new ActionRowBuilder();
    for (let i = 0; i < 5 && index < buttons.length; i++) {
      row.addComponents(buttons[index]);
      index++;
    }
    rows.push(row);
  }

  return rows;
}

/**
 *
 * @param {Message} message
 * @param {string} username
 * @param {*} buttonNumber
 */

const editButton = (message, players, isleave = false, data = null) => {
  players.forEach((player) => {
    message.components.find((btn) => {
      const row = btn.components.some((row) => row.data.custom_id.includes(`_${player.buttonNumber}_`));
      if (row) {
        const exRow = btn.components.find((row) => row.data.custom_id.includes(`_${player.buttonNumber}_`));
        exRow.data.label = player.username;
        exRow.data.disabled = true;
      }
    });
  });
  if (isleave) {
    message.components.find((btn) => {
      const row = btn.components.some((row) => row.data.custom_id.includes(`_${data.buttonNumber}_`));
      if (row) {
        const exRow = btn.components.find((row) => row.data.custom_id.includes(`_${data.buttonNumber}_`));
        exRow.data.label = '';
        exRow.data.disabled = false;
      }
    });
  }
  return message;
};

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms * 1000));
}

module.exports = { commands, emojis, createButtonRows, editButton, sleep };
