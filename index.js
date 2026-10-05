
require("dotenv").config();

const {
  Client,
  GatewayIntentBits,
  Partials,
  Events,
  PermissionsBitField,
  ChannelType,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  SlashCommandBuilder,
  REST,
  Routes
} = require("discord.js");

const discordTranscripts = require("discord-html-transcripts");
const config = require("./config.json");

const TOKEN = process.env.BOT_TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const GUILD_ID = process.env.GUILD_ID;

if (!TOKEN || !CLIENT_ID || !GUILD_ID) {
  console.error("Brakuje BOT_TOKEN, CLIENT_ID lub GUILD_ID w zmiennych srodowiskowych.");
  process.exit(1);
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildModeration
  ],
  partials: [Partials.Channel, Partials.Message, Partials.GuildMember, Partials.User]
});

const cooldowns = new Map();

const NAMES = {
  ADMIN_CATEGORY: "ADMIN",
  TICKET_CATEGORY: "TICKETY",
  TICKET_PANEL: "ticket-panel",
  TICKET_LOGS: "ticket-logi",
  WARN_LOGS: "ostrzezenia-organizacyjne",
  APPLICATION_LOGS: "podania-organizacja",
  ADMIN_CHAT: "admin-chat",
  ADMIN_INFO: "admin-informacje",
  ANNOUNCEMENTS: "ogloszenia",
  WELCOME: "przyloty"
};

function staffRoleIds() {
  return Array.isArray(config.staffRoleIds) ? config.staffRoleIds.filter(Boolean) : [];
}

function isStaff(member) {
  if (!member) return false;
  if (member.permissions.has(PermissionsBitField.Flags.Administrator)) return true;
  return member.roles.cache.some(role => staffRoleIds().includes(role.id));
}

function staffOverwrites(guild) {
  return staffRoleIds().map(id => ({
    id,
    allow: [
      PermissionsBitField.Flags.ViewChannel,
      PermissionsBitField.Flags.SendMessages,
      PermissionsBitField.Flags.ReadMessageHistory,
      PermissionsBitField.Flags.AttachFiles,
      PermissionsBitField.Flags.EmbedLinks,
      PermissionsBitField.Flags.ManageMessages
    ]
  }));
}

function safeName(text) {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9_-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}

async function ensureCategory(guild, name, privateCategory = false) {
  let ch = guild.channels.cache.find(c => c.type === ChannelType.GuildCategory && c.name === name);

  if (!ch) {
    ch = await guild.channels.create({
      name,
      type: ChannelType.GuildCategory,
      permissionOverwrites: privateCategory
        ? [
            {
              id: guild.roles.everyone.id,
              deny: [PermissionsBitField.Flags.ViewChannel]
            },
            ...staffOverwrites(guild)
          ]
        : undefined
    });
  }

  return ch;
}

async function ensureText(guild, name, parent = null, privateChannel = false) {
  let ch = guild.channels.cache.find(c => c.type === ChannelType.GuildText && c.name === name);

  if (!ch) {
    ch = await guild.channels.create({
      name,
      type: ChannelType.GuildText,
      parent: parent?.id ?? null,
      permissionOverwrites: privateChannel
        ? [
            {
              id: guild.roles.everyone.id,
              deny: [PermissionsBitField.Flags.ViewChannel]
            },
            ...staffOverwrites(guild)
          ]
        : undefined
    });
  }

  return ch;
}

async function setupGuild(guild) {
  const admin = await ensureCategory(guild, NAMES.ADMIN_CATEGORY, true);
  const tickets = await ensureCategory(guild, NAMES.TICKET_CATEGORY, true);

  const adminChat = await ensureText(guild, NAMES.ADMIN_CHAT, admin, true);
  const adminInfo = await ensureText(guild, NAMES.ADMIN_INFO, admin, true);
  const ticketLogs = await ensureText(guild, NAMES.TICKET_LOGS, admin, true);
  const warnLogs = await ensureText(guild, NAMES.WARN_LOGS, admin, true);
  const applicationLogs = await ensureText(guild, NAMES.APPLICATION_LOGS, admin, true);

  const announcements = guild.channels.cache.find(
    c => c.type === ChannelType.GuildText && c.name === NAMES.ANNOUNCEMENTS
  );

  const welcome = guild.channels.cache.find(
    c => c.type === ChannelType.GuildText && c.name === NAMES.WELCOME
  );

  let panel = guild.channels.cache.find(c => c.type === ChannelType.GuildText && c.name === NAMES.TICKET_PANEL);
  if (!panel) {
    panel = await guild.channels.create({
      name: NAMES.TICKET_PANEL,
      type: ChannelType.GuildText,
      permissionOverwrites: [
        {
          id: guild.roles.everyone.id,
          allow: [
            PermissionsBitField.Flags.ViewChannel,
            PermissionsBitField.Flags.ReadMessageHistory
          ],
          deny: [PermissionsBitField.Flags.SendMessages]
        }
      ]
    });
  }

  return {
    admin,
    tickets,
    adminChat,
    adminInfo,
    ticketLogs,
    warnLogs,
    applicationLogs,
    announcements,
    welcome,
    panel
  };
}

function ticketPanelComponents() {
  const menu = new StringSelectMenuBuilder()
    .setCustomId("ticket_type")
    .setPlaceholder("Wybierz rodzaj ticketu")
    .addOptions(
      {
        label: "Do organizacji",
        value: "organizacja",
        description: "Podanie do organizacji",
        emoji: "📋"
      },
      {
        label: "Pomoc",
        value: "pomoc",
        description: "Pomoc dotyczaca organizacji lub Discorda",
        emoji: "🛠️"
      },
      {
        label: "Inne",
        value: "inne",
        description: "Pozostale sprawy",
        emoji: "💬"
      }
    );

  return [new ActionRowBuilder().addComponents(menu)];
}

async function sendTicketPanel(channel) {
  const embed = new EmbedBuilder()
    .setTitle("🎫 System ticketow")
    .setDescription(
      [
        "Wybierz ponizej rodzaj ticketu.",
        "",
        "📋 Do organizacji - podanie do organizacji.",
        "🛠️ Pomoc - pytania i problemy.",
        "💬 Inne - pozostale sprawy.",
        "",
        "🔒 Mozesz miec tylko jeden otwarty ticket."
      ].join("\n")
    )
    .setFooter({ text: "Made By : Krvsnall" });

  await channel.send({ embeds: [embed], components: ticketPanelComponents() });
}

function ticketButtons() {
  return [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("ticket_claim")
        .setLabel("Przejmij")
        .setEmoji("👤")
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId("ticket_status_waiting")
        .setLabel("Oczekuje")
        .setEmoji("⏳")
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId("ticket_status_progress")
        .setLabel("W trakcie")
        .setEmoji("🔄")
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId("ticket_close")
        .setLabel("Zamknij")
        .setEmoji("🔒")
        .setStyle(ButtonStyle.Danger)
    )
  ];
}

function getTicketOwnerId(channel) {
  const match = (channel.topic || "").match(/owner=(\d+)/);
  return match ? match[1] : null;
}

async function setTicketStatus(channel, status) {
  const topic = channel.topic || "";
  const updated = /status=[^;]+/.test(topic)
    ? topic.replace(/status=[^;]+/, `status=${status}`)
    : `${topic};status=${status}`;
  await channel.setTopic(updated);
}

async function logTo(guild, channelName, title, description, files = []) {
  const channel = guild.channels.cache.find(c => c.name === channelName);
  if (!channel) return;

  const embed = new EmbedBuilder()
    .setTitle(title)
    .setDescription(description)
    .setFooter({ text: "Made By : Krvsnall" })
    .setTimestamp();

  const payload = { embeds: [embed] };
  if (files.length) payload.files = files;

  await channel.send(payload).catch(() => {});
}



async function getWelcomeChannel(guild) {
  const configuredId = String(config.welcomeChannelId || "").trim();

  // Najpewniejsza metoda: ID kanalu z config.json.
  if (configuredId) {
    try {
      const byId = await guild.channels.fetch(configuredId);
      if (byId && byId.type === ChannelType.GuildText) {
        return byId;
      }
    } catch (err) {
      console.error(`[PRZYLOTY] Nie udalo sie pobrac kanalu po ID ${configuredId}:`, err.message);
    }
  }

  // Odswiez liste kanalow, zamiast polegac tylko na cache.
  try {
    await guild.channels.fetch();
  } catch (err) {
    console.error("[PRZYLOTY] Nie udalo sie odswiezyc listy kanalow:", err.message);
  }

  // Najpierw dokladna nazwa.
  let byName = guild.channels.cache.find(
    c => c.type === ChannelType.GuildText && c.name.toLowerCase() === NAMES.WELCOME.toLowerCase()
  );

  if (byName) return byName;

  // Fallback dla nazw z ozdobnikami/emotkami, np. "・przyloty".
  byName = guild.channels.cache.find(c => {
    if (c.type !== ChannelType.GuildText) return false;
    const normalized = c.name
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]/g, "");

    return normalized.includes("przyloty");
  });

  return byName || null;
}

async function getWarnMessagesForUser(guild, userId) {
  const channel = guild.channels.cache.find(c => c.name === NAMES.WARN_LOGS);
  if (!channel) return [];

  let before;
  const matches = [];

  while (true) {
    const batch = await channel.messages.fetch({
      limit: 100,
      ...(before ? { before } : {})
    }).catch(() => null);

    if (!batch || batch.size === 0) break;

    for (const message of batch.values()) {
      if (message.author.id !== client.user.id) continue;

      for (const embed of message.embeds) {
        if (embed.title !== "Ostrzezenie organizacyjne") continue;
        const idField = embed.fields?.find(f => f.name === "ID uzytkownika");
        if (idField?.value === userId) matches.push(message);
      }
    }

    if (batch.size < 100) break;
    before = batch.last().id;
  }

  matches.sort((a, b) => a.createdTimestamp - b.createdTimestamp);
  return matches;
}

async function countWarnsForUser(guild, userId) {
  const warns = await getWarnMessagesForUser(guild, userId);
  return warns.length;
}

async function tryDm(user, payload) {
  try {
    await user.send(payload);
    return true;
  } catch {
    return false;
  }
}

async function sendWarnLog(guild, targetUser, moderatorUser, reason, warnCount, timeoutApplied) {
  const channel = guild.channels.cache.find(c => c.name === NAMES.WARN_LOGS);
  if (!channel) return;

  const remaining = Math.max(0, 3 - warnCount);

  const embed = new EmbedBuilder()
    .setTitle("Ostrzezenie organizacyjne")
    .setDescription(
      warnCount >= 3
        ? `${targetUser} osiagnal limit ostrzezen.`
        : `${targetUser} otrzymal ostrzezenie. Do automatycznej kary pozostalo: ${remaining}.`
    )
    .addFields(
      { name: "Uzytkownik", value: `${targetUser}`, inline: true },
      { name: "Stan ostrzezen", value: `${warnCount}/3`, inline: true },
      { name: "Administrator", value: `${moderatorUser}`, inline: true },
      { name: "Powod", value: reason.slice(0, 1024), inline: false },
      { name: "Kara", value: timeoutApplied ? "Timeout na 7 dni" : "Brak", inline: true },
      { name: "ID uzytkownika", value: targetUser.id, inline: true }
    )
    .setThumbnail(targetUser.displayAvatarURL({ size: 256 }))
    .setFooter({ text: "CZITERKI | Made By : Krvsnall" })
    .setTimestamp();

  await channel.send({ embeds: [embed] });
}

function applicationModal() {
  const modal = new ModalBuilder()
    .setCustomId("application_modal")
    .setTitle("Podanie do organizacji");

  const age = new TextInputBuilder()
    .setCustomId("wiek")
    .setLabel("Wiek")
    .setStyle(TextInputStyle.Short)
    .setRequired(true);

  const fm = new TextInputBuilder()
    .setCustomId("fm")
    .setLabel("FM")
    .setStyle(TextInputStyle.Short)
    .setRequired(true);

  const hours = new TextInputBuilder()
    .setCustomId("godziny")
    .setLabel("Ilosc godzin w FiveM")
    .setStyle(TextInputStyle.Short)
    .setRequired(true);

  const kd = new TextInputBuilder()
    .setCustomId("kd")
    .setLabel("SS KD")
    .setPlaceholder("Wklej link do screena lub napisz, ze wyslesz go w tickecie")
    .setStyle(TextInputStyle.Paragraph)
    .setRequired(true);

  modal.addComponents(
    new ActionRowBuilder().addComponents(age),
    new ActionRowBuilder().addComponents(fm),
    new ActionRowBuilder().addComponents(hours),
    new ActionRowBuilder().addComponents(kd)
  );

  return modal;
}

async function createTicket(interaction, type) {
  const guild = interaction.guild;
  const setup = await setupGuild(guild);

  const openTicket = guild.channels.cache.find(
    c =>
      c.type === ChannelType.GuildText &&
      (c.topic || "").includes(`owner=${interaction.user.id}`) &&
      !(c.topic || "").includes("status=closed")
  );

  if (openTicket) {
    return interaction.editReply(`Masz juz otwarty ticket: ${openTicket}`);
  }

  const cooldownMs = Math.max(0, Number(config.ticketCooldownSeconds || 60)) * 1000;
  const last = cooldowns.get(interaction.user.id) || 0;
  const left = cooldownMs - (Date.now() - last);

  if (left > 0) {
    return interaction.editReply(`Poczekaj jeszcze ${Math.ceil(left / 1000)} sekund.`);
  }

  cooldowns.set(interaction.user.id, Date.now());

  const labels = {
    organizacja: "Do organizacji",
    pomoc: "Pomoc",
    inne: "Inne"
  };

  const ticket = await guild.channels.create({
    name: safeName(`${type}-${interaction.user.username}`),
    type: ChannelType.GuildText,
    parent: setup.tickets.id,
    topic: `owner=${interaction.user.id};type=${type};status=open;claimed=none`,
    permissionOverwrites: [
      {
        id: guild.roles.everyone.id,
        deny: [PermissionsBitField.Flags.ViewChannel]
      },
      {
        id: interaction.user.id,
        allow: [
          PermissionsBitField.Flags.ViewChannel,
          PermissionsBitField.Flags.SendMessages,
          PermissionsBitField.Flags.ReadMessageHistory,
          PermissionsBitField.Flags.AttachFiles,
          PermissionsBitField.Flags.EmbedLinks
        ]
      },
      ...staffOverwrites(guild)
    ]
  });

  const embed = new EmbedBuilder()
    .setTitle(`🎫 Ticket - ${labels[type]}`)
    .setDescription(
      [
        `👤 Autor: ${interaction.user}`,
        "🟢 Status: Otwarty",
        "",
        type === "organizacja"
          ? "Uzupelnij formularz podania. SS KD mozesz tez wyslac jako plik w tickecie."
          : "Opisz dokladnie swoja sprawe."
      ].join("\n")
    )
    .setFooter({ text: "Made By : Krvsnall" })
    .setTimestamp();

  await ticket.send({
    content: `${interaction.user}`,
    embeds: [embed],
    components: ticketButtons()
  });

  await logTo(
    guild,
    NAMES.TICKET_LOGS,
    "Utworzono ticket",
    `Autor: ${interaction.user.tag}\nTyp: ${labels[type]}\nKanal: ${ticket}\nStatus: Otwarty`
  );

  if (type === "organizacja") {
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("open_application")
        .setLabel("Wypelnij podanie")
        .setEmoji("📝")
        .setStyle(ButtonStyle.Primary)
    );

    await ticket.send({
      content: "Wypelnij formularz podania.",
      components: [row]
    });
  }

  return interaction.editReply(`🎫 Ticket utworzony: ${ticket}`);
}

async function closeTicket(interaction) {
  const ownerId = getTicketOwnerId(interaction.channel);
  const allowed = interaction.user.id === ownerId || isStaff(interaction.member);

  if (!allowed) {
    return interaction.reply({
      content: "Nie mozesz zamknac tego ticketu.",
      ephemeral: true
    });
  }

  await interaction.deferReply({ ephemeral: true });

  let transcript = null;
  try {
    transcript = await discordTranscripts.createTranscript(interaction.channel, {
      limit: -1,
      returnType: "attachment",
      filename: `transkrypt-${interaction.channel.name}-${Date.now()}.html`,
      saveImages: true,
      poweredBy: false,
      footerText: "CZITERKI - transkrypt ticketu"
    });
  } catch (err) {
    console.error("Blad transkryptu:", err);
  }

  await setTicketStatus(interaction.channel, "closed");

  await logTo(
    interaction.guild,
    NAMES.TICKET_LOGS,
    "Zamknieto ticket",
    `Kanal: ${interaction.channel.name}\nZamknal: ${interaction.user.tag}\nStatus: Zamkniety`,
    transcript ? [transcript] : []
  );

  await interaction.editReply("Ticket zostanie usuniety za 3 sekundy.");

  setTimeout(() => {
    interaction.channel.delete("Ticket zamkniety").catch(() => {});
  }, 3000);
}

const commands = [
  new SlashCommandBuilder()
    .setName("setup")
    .setDescription("Tworzy kanaly, logi i panel ticketow"),

  new SlashCommandBuilder()
    .setName("panel")
    .setDescription("Wysyla panel ticketow"),

  new SlashCommandBuilder()
    .setName("warn")
    .setDescription("Nadaje ostrzezenie organizacyjne")
    .addUserOption(o =>
      o.setName("osoba").setDescription("Osoba").setRequired(true)
    )
    .addStringOption(o =>
      o.setName("powod").setDescription("Powod ostrzezenia").setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("warny")
    .setDescription("Pokazuje liczbe ostrzezen")
    .addUserOption(o =>
      o.setName("osoba").setDescription("Osoba").setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("unwarn")
    .setDescription("Usuwa konkretny warn osoby")
    .addUserOption(o =>
      o.setName("osoba").setDescription("Osoba").setRequired(true)
    )
    .addIntegerOption(o =>
      o.setName("numer").setDescription("Numer warna").setMinValue(1).setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("clearwarns")
    .setDescription("Usuwa wszystkie warny osoby")
    .addUserOption(o =>
      o.setName("osoba").setDescription("Osoba").setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("clear")
    .setDescription("Usuwa wiadomosci z aktualnego kanalu")
    .addIntegerOption(o =>
      o.setName("ilosc")
        .setDescription("Ile wiadomosci usunac")
        .setMinValue(1)
        .setMaxValue(100)
        .setRequired(true)
    )
    .addUserOption(o =>
      o.setName("osoba")
        .setDescription("Opcjonalnie: tylko wiadomosci tej osoby")
        .setRequired(false)
    ),

  new SlashCommandBuilder()
    .setName("ogloszenie")
    .setDescription("Wysyla ogloszenie jako bot i pozwala pingowac")
    .addStringOption(o =>
      o.setName("tresc").setDescription("Tresc ogloszenia").setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("testprzyloty")
    .setDescription("Testuje wiadomosc na kanale przyloty"),

  new SlashCommandBuilder()
    .setName("zamknij")
    .setDescription("Zamyka aktualny ticket")
].map(cmd => cmd.toJSON());

client.once(Events.ClientReady, async readyClient => {
  console.log(`Bot uruchomiony jako ${readyClient.user.tag}`);
  readyClient.user.setActivity("Made By : Krvsnall");

  const guild = readyClient.guilds.cache.get(GUILD_ID);

  if (!guild) {
    console.error(`BLAD: Bot nie jest na serwerze o GUILD_ID=${GUILD_ID}.`);
    console.error("Sprawdz GUILD_ID i upewnij sie, ze ten bot jest dodany na ten serwer.");
    return;
  }

  console.log(`Znaleziono serwer: ${guild.name} (${guild.id})`);

  const rest = new REST({ version: "10" }).setToken(TOKEN);

  try {
    await rest.put(
      Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID),
      { body: commands }
    );
    console.log("Komendy slash zostaly zarejestrowane na serwerze.");
  } catch (err) {
    console.error("BLAD REJESTRACJI KOMEND:", err);
  }
});

client.on(Events.InteractionCreate, async interaction => {
  if (!interaction.guild) return;

  if (interaction.isChatInputCommand()) {
    if (interaction.commandName === "setup") {
      if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
        return interaction.reply({
          content: "Tylko administrator moze uzyc tej komendy.",
          ephemeral: true
        });
      }

      await interaction.deferReply({ ephemeral: true });
      const setup = await setupGuild(interaction.guild);

      const recent = await setup.panel.messages.fetch({ limit: 20 }).catch(() => null);
      const exists = recent?.some(m => m.author.id === client.user.id && m.components.length > 0);

      if (!exists) {
        await sendTicketPanel(setup.panel);
      }

      return interaction.editReply("Gotowe. Bot nie tworzy kanalow ogloszenia ani przyloty. Kanaly logi i logi-moderacyjne zostaly usuniete.");
    }

    if (interaction.commandName === "panel") {
      if (!isStaff(interaction.member)) {
        return interaction.reply({ content: "Ta komenda jest tylko dla administracji.", ephemeral: true });
      }

      await sendTicketPanel(interaction.channel);
      return interaction.reply({ content: "Panel zostal wyslany.", ephemeral: true });
    }

    if (interaction.commandName === "warn") {
      if (!isStaff(interaction.member)) {
        return interaction.reply({ content: "Ta komenda jest tylko dla administracji.", ephemeral: true });
      }

      const user = interaction.options.getUser("osoba");
      const reason = interaction.options.getString("powod");

      if (user.bot) {
        return interaction.reply({ content: "Nie mozna nadac warna botowi.", ephemeral: true });
      }

      await interaction.deferReply({ ephemeral: true });
      await setupGuild(interaction.guild);

      const warnCount = (await countWarnsForUser(interaction.guild, user.id)) + 1;

      let timeoutApplied = false;
      let timeoutError = null;

      if (warnCount === 3) {
        try {
          const member = await interaction.guild.members.fetch(user.id);

          if (!member.moderatable) {
            timeoutError = "Bot nie moze wyciszyc tej osoby. Sprawdz hierarchie rang.";
          } else {
            await member.timeout(
              7 * 24 * 60 * 60 * 1000,
              `3 ostrzezenia organizacyjne. Ostatni powod: ${reason}`
            );
            timeoutApplied = true;
          }
        } catch (err) {
          console.error("Blad timeoutu:", err);
          timeoutError = "Nie udalo sie nadac timeoutu.";
        }
      }

      await sendWarnLog(
        interaction.guild,
        user,
        interaction.user,
        reason,
        warnCount,
        timeoutApplied
      );

      await tryDm(user, {
        embeds: [
          new EmbedBuilder()
            .setTitle("Otrzymales ostrzezenie organizacyjne")
            .addFields(
              { name: "Serwer", value: interaction.guild.name, inline: false },
              { name: "Powod", value: reason.slice(0, 1024), inline: false },
              { name: "Liczba warnow", value: `${warnCount}/3`, inline: true },
              { name: "Kara", value: timeoutApplied ? "Timeout na 7 dni." : "Brak dodatkowej kary.", inline: true }
            )
            .setFooter({ text: "Made By : Krvsnall" })
            .setTimestamp()
        ]
      });

      let response = `Warn nadany. Liczba warnow: ${warnCount}/3.`;
      if (timeoutApplied) response += " Uzytkownik dostal timeout na 7 dni.";
      if (warnCount === 3 && timeoutError) response += ` ${timeoutError}`;

      return interaction.editReply(response);
    }

    if (interaction.commandName === "warny") {
      if (!isStaff(interaction.member)) {
        return interaction.reply({ content: "Ta komenda jest tylko dla administracji.", ephemeral: true });
      }

      const user = interaction.options.getUser("osoba");
      await setupGuild(interaction.guild);
      const warns = await getWarnMessagesForUser(interaction.guild, user.id);

      const embed = new EmbedBuilder()
        .setTitle("Ostrzezenia organizacyjne")
        .setThumbnail(user.displayAvatarURL({ size: 256 }))
        .addFields(
          { name: "Uzytkownik", value: `${user}`, inline: true },
          { name: "Liczba", value: `${warns.length}/3`, inline: true }
        )
        .setFooter({ text: "Made By : Krvsnall" })
        .setTimestamp();

      if (warns.length) {
        warns.slice(0, 10).forEach((msg, index) => {
          const reason = msg.embeds[0]?.fields?.find(f => f.name === "Powod")?.value || "Brak danych";
          embed.addFields({
            name: `Warn ${index + 1}`,
            value: reason.slice(0, 1024),
            inline: false
          });
        });
      }

      return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    if (interaction.commandName === "unwarn") {
      if (!isStaff(interaction.member)) {
        return interaction.reply({ content: "Ta komenda jest tylko dla administracji.", ephemeral: true });
      }

      const user = interaction.options.getUser("osoba");
      const number = interaction.options.getInteger("numer");

      await interaction.deferReply({ ephemeral: true });
      await setupGuild(interaction.guild);

      const warns = await getWarnMessagesForUser(interaction.guild, user.id);

      if (!warns.length) return interaction.editReply("Ta osoba nie ma warnow.");
      if (number > warns.length) return interaction.editReply(`Ta osoba ma tylko ${warns.length} warnow.`);

      const msg = warns[number - 1];
      const reason = msg.embeds[0]?.fields?.find(f => f.name === "Powod")?.value || "Brak danych";

      await msg.delete().catch(() => {});
      const remaining = await countWarnsForUser(interaction.guild, user.id);

      await tryDm(user, {
        embeds: [
          new EmbedBuilder()
            .setTitle("Usunieto ostrzezenie")
            .setDescription(`Warn numer ${number} zostal usuniety.`)
            .addFields({ name: "Aktualna liczba", value: `${remaining}/3` })
            .setFooter({ text: "Made By : Krvsnall" })
            .setTimestamp()
        ]
      });

      return interaction.editReply(`Usunieto warn numer ${number}. Pozostalo ${remaining}/3.`);
    }

    if (interaction.commandName === "clearwarns") {
      if (!isStaff(interaction.member)) {
        return interaction.reply({ content: "Ta komenda jest tylko dla administracji.", ephemeral: true });
      }

      const user = interaction.options.getUser("osoba");

      await interaction.deferReply({ ephemeral: true });
      await setupGuild(interaction.guild);

      const warns = await getWarnMessagesForUser(interaction.guild, user.id);
      if (!warns.length) return interaction.editReply("Ta osoba nie ma warnow.");

      let deleted = 0;
      for (const msg of warns) {
        try {
          await msg.delete();
          deleted++;
        } catch {}
      }

      await tryDm(user, {
        embeds: [
          new EmbedBuilder()
            .setTitle("Wyczyszczono ostrzezenia")
            .setDescription("Wszystkie Twoje warny zostaly usuniete.")
            .setFooter({ text: "Made By : Krvsnall" })
            .setTimestamp()
        ]
      });

      return interaction.editReply(`Usunieto ${deleted} warnow.`);
    }

    if (interaction.commandName === "clear") {
      if (!isStaff(interaction.member)) {
        return interaction.reply({ content: "Ta komenda jest tylko dla administracji.", ephemeral: true });
      }

      const amount = interaction.options.getInteger("ilosc");
      const targetUser = interaction.options.getUser("osoba");

      await interaction.deferReply({ ephemeral: true });

      let selected = [];
      let before;
      let scanned = 0;
      const maxScan = targetUser ? 1000 : 100;

      while (selected.length < amount && scanned < maxScan) {
        const fetchLimit = Math.min(100, maxScan - scanned);
        const batch = await interaction.channel.messages.fetch({
          limit: fetchLimit,
          ...(before ? { before } : {})
        }).catch(() => null);

        if (!batch || batch.size === 0) break;
        scanned += batch.size;

        for (const message of batch.values()) {
          if (selected.length >= amount) break;

          const fourteenDays = 14 * 24 * 60 * 60 * 1000;
          if (Date.now() - message.createdTimestamp >= fourteenDays) continue;
          if (targetUser && message.author.id !== targetUser.id) continue;

          selected.push(message);
        }

        before = batch.last()?.id;
        if (batch.size < fetchLimit) break;
      }

      if (!selected.length) {
        return interaction.editReply("Nie znaleziono wiadomosci mozliwych do usuniecia.");
      }

      let deletedCount = 0;

      try {
        if (selected.length === 1) {
          await selected[0].delete();
          deletedCount = 1;
        } else {
          const result = await interaction.channel.bulkDelete(selected, true);
          deletedCount = result.size;
        }
      } catch (err) {
        console.error("Blad /clear:", err);
        return interaction.editReply("Nie udalo sie usunac wiadomosci.");
      }

      return interaction.editReply(
        targetUser
          ? `Usunieto ${deletedCount} wiadomosci uzytkownika ${targetUser}.`
          : `Usunieto ${deletedCount} wiadomosci.`
      );
    }

    if (interaction.commandName === "ogloszenie") {
      if (!isStaff(interaction.member)) {
        return interaction.reply({ content: "Ta komenda jest tylko dla administracji.", ephemeral: true });
      }

      const content = interaction.options.getString("tresc");
      const setup = await setupGuild(interaction.guild);

      if (!setup.announcements) {
        return interaction.reply({
          content: "Nie znaleziono kanalu ogloszenia. Kanal musi nazywac sie dokladnie: ogloszenia",
          ephemeral: true
        });
      }

      const embed = new EmbedBuilder()
        .setTitle("Ogloszenie organizacji")
        .setDescription(content)
        .addFields(
          { name: "Opublikowal", value: `${interaction.user}`, inline: true },
          { name: "Serwer", value: "CZITERKI", inline: true }
        )
        .setFooter({ text: "CZITERKI | Made By : Krvsnall" })
        .setTimestamp();

      await setup.announcements.send({
        embeds: [embed],
        allowedMentions: { parse: ["users", "roles", "everyone"] }
      });

      return interaction.reply({ content: "Ogloszenie zostalo wyslane.", ephemeral: true });
    }

    if (interaction.commandName === "testprzyloty") {
      if (!isStaff(interaction.member)) {
        return interaction.reply({
          content: "Ta komenda jest tylko dla administracji.",
          ephemeral: true
        });
      }

      const welcome = await getWelcomeChannel(interaction.guild);

      if (!welcome) {
        return interaction.reply({
          content: "Nie znaleziono kanalu przyloty. Ustaw welcomeChannelId w config.json.",
          ephemeral: true
        });
      }

      const embed = new EmbedBuilder()
        .setTitle("Test przylotow")
        .setDescription(
          [
            `Witaj ${interaction.user}, test systemu przylotow dziala poprawnie.`,
            "",
            `Aktualna liczba osob: ${interaction.guild.memberCount}.`
          ].join("\n")
        )
        .setThumbnail(interaction.user.displayAvatarURL({ size: 256, extension: "png" }))
        .setFooter({ text: "CZITERKI | Made By : Krvsnall" })
        .setTimestamp();

      try {
        await welcome.send({ embeds: [embed] });
        return interaction.reply({
          content: `Test wyslany na ${welcome}.`,
          ephemeral: true
        });
      } catch (err) {
        console.error("[PRZYLOTY] Blad testu:", err);
        return interaction.reply({
          content: "Nie udalo sie wyslac testu. Sprawdz uprawnienia bota do kanalu przyloty.",
          ephemeral: true
        });
      }
    }

    if (interaction.commandName === "zamknij") {
      if (!getTicketOwnerId(interaction.channel)) {
        return interaction.reply({ content: "To nie jest kanal ticketu.", ephemeral: true });
      }

      return closeTicket(interaction);
    }
  }

  if (interaction.isStringSelectMenu() && interaction.customId === "ticket_type") {
    await interaction.deferReply({ ephemeral: true });
    return createTicket(interaction, interaction.values[0]);
  }

  if (interaction.isButton()) {
    if (
      interaction.customId.startsWith("application_accept:") ||
      interaction.customId.startsWith("application_reject:")
    ) {
      if (!isStaff(interaction.member)) {
        return interaction.reply({ content: "Ta opcja jest tylko dla administracji.", ephemeral: true });
      }

      const [action, userId, ticketChannelId] = interaction.customId.split(":");
      const accepted = action === "application_accept";
      const user = await client.users.fetch(userId).catch(() => null);
      const ticketChannel = interaction.guild.channels.cache.get(ticketChannelId);

      const oldEmbed = interaction.message.embeds[0];
      const updated = EmbedBuilder.from(oldEmbed)
        .setFields(
          ...oldEmbed.fields.filter(f => f.name !== "Status" && f.name !== "Decyzja"),
          { name: "Status", value: accepted ? "Przyjete" : "Odrzucone", inline: true },
          { name: "Decyzja", value: `${interaction.user}`, inline: true }
        )
        .setFooter({ text: "Made By : Krvsnall" });

      await interaction.message.edit({ embeds: [updated], components: [] });

      if (ticketChannel?.isTextBased()) {
        await ticketChannel.send(
          accepted
            ? `Twoje podanie zostalo przyjete przez ${interaction.user}.`
            : `Twoje podanie zostalo odrzucone przez ${interaction.user}.`
        ).catch(() => {});
      }

      if (user) {
        await tryDm(user, {
          embeds: [
            new EmbedBuilder()
              .setTitle(accepted ? "Podanie przyjete" : "Podanie odrzucone")
              .setDescription(
                accepted
                  ? "Twoje podanie do organizacji CZITERKI zostalo przyjete."
                  : "Twoje podanie do organizacji CZITERKI zostalo odrzucone."
              )
              .setFooter({ text: "Made By : Krvsnall" })
              .setTimestamp()
          ]
        });
      }

      return interaction.reply({
        content: accepted ? "Podanie zostalo przyjete." : "Podanie zostalo odrzucone.",
        ephemeral: true
      });
    }

    if (interaction.customId === "open_application") {
      const ownerId = getTicketOwnerId(interaction.channel);

      if (interaction.user.id !== ownerId) {
        return interaction.reply({
          content: "Tylko autor ticketu moze wypelnic podanie.",
          ephemeral: true
        });
      }

      return interaction.showModal(applicationModal());
    }

    if (interaction.customId === "ticket_claim") {
      if (!isStaff(interaction.member)) {
        return interaction.reply({
          content: "Tylko administracja moze przejac ticket.",
          ephemeral: true
        });
      }

      const topic = interaction.channel.topic || "";
      const updated = /claimed=[^;]+/.test(topic)
        ? topic.replace(/claimed=[^;]+/, `claimed=${interaction.user.id}`)
        : `${topic};claimed=${interaction.user.id}`;

      await interaction.channel.setTopic(updated);

      return interaction.reply({ content: `Ticket przejal ${interaction.user}.` });
    }

    if (interaction.customId === "ticket_status_waiting") {
      if (!isStaff(interaction.member)) {
        return interaction.reply({
          content: "Tylko administracja moze zmieniac status ticketu.",
          ephemeral: true
        });
      }

      await setTicketStatus(interaction.channel, "waiting");

      await logTo(
        interaction.guild,
        NAMES.TICKET_LOGS,
        "Zmiana statusu ticketu",
        `Kanal: ${interaction.channel}\nStatus: Oczekuje\nZmienil: ${interaction.user}`
      );

      return interaction.reply("⏳ Status ticketu: Oczekuje");
    }

    if (interaction.customId === "ticket_status_progress") {
      if (!isStaff(interaction.member)) {
        return interaction.reply({
          content: "Tylko administracja moze zmieniac status ticketu.",
          ephemeral: true
        });
      }

      await setTicketStatus(interaction.channel, "progress");

      await logTo(
        interaction.guild,
        NAMES.TICKET_LOGS,
        "Zmiana statusu ticketu",
        `Kanal: ${interaction.channel}\nStatus: W trakcie\nZmienil: ${interaction.user}`
      );

      return interaction.reply("🔄 Status ticketu: W trakcie");
    }

    if (interaction.customId === "ticket_close") {
      return closeTicket(interaction);
    }
  }

  if (interaction.isModalSubmit() && interaction.customId === "application_modal") {
    const ownerId = getTicketOwnerId(interaction.channel);

    if (interaction.user.id !== ownerId) {
      return interaction.reply({
        content: "Tylko autor ticketu moze wyslac podanie.",
        ephemeral: true
      });
    }

    const age = interaction.fields.getTextInputValue("wiek");
    const fm = interaction.fields.getTextInputValue("fm");
    const hours = interaction.fields.getTextInputValue("godziny");
    const kd = interaction.fields.getTextInputValue("kd");

    const embed = new EmbedBuilder()
      .setTitle("Podanie do organizacji")
      .setDescription(
        [
          `Osoba: ${interaction.user}`,
          `Wiek: ${age}`,
          `FM: ${fm}`,
          `Ilosc godzin w FiveM: ${hours}`,
          `SS KD: ${kd}`,
          "",
          "Jezeli SS KD jest plikiem, wyslij go na tym kanale."
        ].join("\n")
      )
      .setFooter({ text: "Made By : Krvsnall" })
      .setTimestamp();

    await interaction.channel.send({ embeds: [embed] });

    const applicationChannel = interaction.guild.channels.cache.find(
      c => c.name === NAMES.APPLICATION_LOGS
    );

    if (applicationChannel) {
      const applicationEmbed = new EmbedBuilder()
        .setTitle("Nowe podanie do organizacji")
        .addFields(
          { name: "Osoba", value: `${interaction.user} (${interaction.user.id})`, inline: false },
          { name: "Wiek", value: age, inline: true },
          { name: "FM", value: fm, inline: true },
          { name: "Ilosc godzin w FiveM", value: hours, inline: true },
          { name: "SS KD", value: kd, inline: false },
          { name: "Ticket", value: `${interaction.channel}`, inline: false },
          { name: "Status", value: "Oczekuje", inline: true }
        )
        .setThumbnail(interaction.user.displayAvatarURL({ size: 256 }))
        .setFooter({ text: "Made By : Krvsnall" })
        .setTimestamp();

      const buttons = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`application_accept:${interaction.user.id}:${interaction.channel.id}`)
          .setLabel("Przyjmij")
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId(`application_reject:${interaction.user.id}:${interaction.channel.id}`)
          .setLabel("Odrzuc")
          .setStyle(ButtonStyle.Danger)
      );

      await applicationChannel.send({ embeds: [applicationEmbed], components: [buttons] });
    }

    return interaction.reply({ content: "Podanie zostalo wyslane.", ephemeral: true });
  }
});

client.on(Events.GuildMemberAdd, async member => {
  console.log(`[PRZYLOTY] Wykryto wejscie: ${member.user.tag} (${member.id})`);

  const welcome = await getWelcomeChannel(member.guild);

  if (!welcome) {
    console.error(
      `[PRZYLOTY] Nie znaleziono kanalu przyloty. ` +
      `Najlepiej wpisz welcomeChannelId w config.json.`
    );
    return;
  }

  const botMember = member.guild.members.me || await member.guild.members.fetchMe().catch(() => null);

  if (!botMember) {
    console.error("[PRZYLOTY] Nie udalo sie pobrac danych bota na serwerze.");
    return;
  }

  const perms = welcome.permissionsFor(botMember);

  const missingPerms = [];
  if (!perms?.has(PermissionsBitField.Flags.ViewChannel)) missingPerms.push("View Channel");
  if (!perms?.has(PermissionsBitField.Flags.SendMessages)) missingPerms.push("Send Messages");
  if (!perms?.has(PermissionsBitField.Flags.EmbedLinks)) missingPerms.push("Embed Links");

  if (missingPerms.length) {
    console.error(
      `[PRZYLOTY] Brak uprawnien na #${welcome.name}: ${missingPerms.join(", ")}`
    );
    return;
  }

  const embed = new EmbedBuilder()
    .setTitle("Nowy uzytkownik")
    .setDescription(
      [
        `Witaj ${member}, jako nowy uzytkownik serwera CZITERKI!`,
        "",
        `Jestes naszym ${member.guild.memberCount}. uzytkownikiem!`
      ].join("\n")
    )
    .setThumbnail(member.user.displayAvatarURL({ size: 256, extension: "png" }))
    .setFooter({ text: "CZITERKI | Made By : Krvsnall" })
    .setTimestamp();

  try {
    await welcome.send({ embeds: [embed] });
    console.log(`[PRZYLOTY] Powitanie wyslane na #${welcome.name} (${welcome.id})`);
  } catch (err) {
    console.error("[PRZYLOTY] Blad wysylania powitania:", err);
  }
});







client.login(TOKEN);
