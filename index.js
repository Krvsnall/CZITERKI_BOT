
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
  console.error("Uzupelnij BOT_TOKEN, CLIENT_ID i GUILD_ID w pliku .env");
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
  partials: [
    Partials.Channel,
    Partials.Message,
    Partials.GuildMember,
    Partials.User
  ]
});

const ticketCooldowns = new Map();

const NAMES = {
  ADMIN_CATEGORY: "ADMIN",
  TICKET_CATEGORY: "TICKETY",
  TICKET_PANEL: "ticket-panel",
  TICKET_LOGS: "ticket-logi",
  WARN_LOGS: "ostrzezenia-organizacyjne",
  APPLICATION_LOGS: "podania-organizacja",
  GENERAL_LOGS: "logi",
  ADMIN_CHAT: "admin-chat",
  ADMIN_INFO: "admin-informacje"
};

function staffRoleIds() {
  return Array.isArray(config.staffRoleIds)
    ? config.staffRoleIds.filter(Boolean)
    : [];
}

function isStaff(member) {
  if (!member) return false;
  if (member.permissions.has(PermissionsBitField.Flags.Administrator)) return true;
  return member.roles.cache.some(r => staffRoleIds().includes(r.id));
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

async function ensureCategory(guild, name, privateCategory = false) {
  let channel = guild.channels.cache.find(
    c => c.type === ChannelType.GuildCategory && c.name === name
  );

  if (!channel) {
    const overwrites = privateCategory
      ? [
          {
            id: guild.roles.everyone.id,
            deny: [PermissionsBitField.Flags.ViewChannel]
          },
          ...staffOverwrites(guild)
        ]
      : undefined;

    channel = await guild.channels.create({
      name,
      type: ChannelType.GuildCategory,
      permissionOverwrites: overwrites
    });
  }

  return channel;
}

async function ensureText(guild, name, parent = null, privateChannel = false) {
  let channel = guild.channels.cache.find(
    c => c.type === ChannelType.GuildText && c.name === name
  );

  if (!channel) {
    const overwrites = privateChannel
      ? [
          {
            id: guild.roles.everyone.id,
            deny: [PermissionsBitField.Flags.ViewChannel]
          },
          ...staffOverwrites(guild)
        ]
      : undefined;

    channel = await guild.channels.create({
      name,
      type: ChannelType.GuildText,
      parent: parent ? parent.id : null,
      permissionOverwrites: overwrites
    });
  }

  return channel;
}

async function setupGuild(guild) {
  const admin = await ensureCategory(guild, NAMES.ADMIN_CATEGORY, true);
  const tickets = await ensureCategory(guild, NAMES.TICKET_CATEGORY, true);

  const adminChat = await ensureText(guild, NAMES.ADMIN_CHAT, admin, true);
  const adminInfo = await ensureText(guild, NAMES.ADMIN_INFO, admin, true);
  const ticketLogs = await ensureText(guild, NAMES.TICKET_LOGS, admin, true);
  const warnLogs = await ensureText(guild, NAMES.WARN_LOGS, admin, true);
  const applicationLogs = await ensureText(guild, NAMES.APPLICATION_LOGS, admin, true);
  const generalLogs = await ensureText(guild, NAMES.GENERAL_LOGS, admin, true);

  let panel = guild.channels.cache.find(
    c => c.type === ChannelType.GuildText && c.name === NAMES.TICKET_PANEL
  );

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
    generalLogs,
    panel
  };
}

function panelComponents() {
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
    .setFooter({ text: "clowns.cool" });

  await channel.send({
    embeds: [embed],
    components: panelComponents()
  });
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

function safeName(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}

function getTicketOwnerId(channel) {
  const match = (channel.topic || "").match(/owner=(\d+)/);
  return match ? match[1] : null;
}

function getTicketType(channel) {
  const match = (channel.topic || "").match(/type=([^;]+)/);
  return match ? match[1] : null;
}

async function setTicketStatus(channel, status) {
  const topic = channel.topic || "";
  let updated;

  if (/status=[^;]+/.test(topic)) {
    updated = topic.replace(/status=[^;]+/, `status=${status}`);
  } else {
    updated = `${topic};status=${status}`;
  }

  await channel.setTopic(updated);
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
    .setPlaceholder("Wpisz swoje FM")
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
    .setPlaceholder("Wklej link do screena lub opisz gdzie go wyslesz")
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

async function logTo(guild, channelName, title, description, files = []) {
  const channel = guild.channels.cache.find(c => c.name === channelName);
  if (!channel) return;

  const embed = new EmbedBuilder()
    .setTitle(title)
    .setDescription(description)
    .setTimestamp();

  const payload = { embeds: [embed] };
  if (files.length) payload.files = files;

  await channel.send(payload).catch(() => {});
}


async function countWarnsForUser(guild, userId) {
  const channel = guild.channels.cache.find(c => c.name === NAMES.WARN_LOGS);
  if (!channel) return 0;

  let before;
  let count = 0;

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
        if (idField?.value === userId) {
          count++;
        }
      }
    }

    if (batch.size < 100) break;
    before = batch.last().id;
  }

  return count;
}

async function sendWarnLog(guild, targetUser, moderatorUser, reason, warnCount, muteApplied) {
  const channel = guild.channels.cache.find(c => c.name === NAMES.WARN_LOGS);
  if (!channel) return;

  const embed = new EmbedBuilder()
    .setTitle("Ostrzezenie organizacyjne")
    .setDescription(`Uzytkownik otrzymal ostrzezenie organizacyjne.`)
    .addFields(
      { name: "Uzytkownik", value: `${targetUser}`, inline: true },
      { name: "Liczba ostrzezen", value: `${warnCount}/3`, inline: true },
      { name: "Nadane przez", value: `${moderatorUser}`, inline: true },
      { name: "ID uzytkownika", value: targetUser.id, inline: false },
      { name: "Powod", value: reason.slice(0, 1024), inline: false },
      {
        name: "Kara automatyczna",
        value: muteApplied
          ? "Wyciszenie na 7 dni za osiagniecie 3 ostrzezen."
          : warnCount < 3
            ? `Brak. Do automatycznego wyciszenia pozostalo: ${3 - warnCount}.`
            : "Brak nowej kary przy tym ostrzezeniu.",
        inline: false
      }
    )
    .setThumbnail(targetUser.displayAvatarURL({ size: 256 }))
    .setFooter({ text: "System ostrzezen organizacyjnych" })
    .setTimestamp();

  await channel.send({ embeds: [embed] });
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
    return interaction.editReply(
      `Masz juz otwarty ticket: ${openTicket}`
    );
  }

  const cooldownMs = Math.max(0, Number(config.ticketCooldownSeconds || 60)) * 1000;
  const last = ticketCooldowns.get(interaction.user.id) || 0;
  const left = cooldownMs - (Date.now() - last);

  if (left > 0) {
    return interaction.editReply(
      `Poczekaj jeszcze ${Math.ceil(left / 1000)} sekund przed utworzeniem kolejnego ticketu.`
    );
  }

  ticketCooldowns.set(interaction.user.id, Date.now());

  const labels = {
    organizacja: "Do organizacji",
    pomoc: "Pomoc",
    inne: "Inne"
  };

  const channel = await guild.channels.create({
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
        `🟢 Status: Otwarty`,
        "",
        type === "organizacja"
          ? "Uzupelnij formularz podania. Jezeli masz screen KD jako plik, wyslij go potem na tym kanale."
          : "Opisz dokladnie swoja sprawe."
      ].join("\n")
    )
    .setTimestamp();

  const msg = await channel.send({
    content: `${interaction.user}`,
    embeds: [embed],
    components: ticketButtons()
  });

  await logTo(
    guild,
    NAMES.TICKET_LOGS,
    "Utworzono ticket",
    `Autor: ${interaction.user.tag}\nTyp: ${labels[type]}\nKanal: ${channel}\nStatus: Otwarty`
  );

  if (type === "organizacja") {
    await interaction.editReply({
      content: `Ticket utworzony: ${channel}`
    });

    // Modal musi byc wyswietlony z osobnej interakcji, wiec wysylamy przycisk do formularza.
    const applyButton = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("open_application")
        .setLabel("Wypelnij podanie")
        .setEmoji("📝")
        .setStyle(ButtonStyle.Primary)
    );

    await channel.send({
      content: "Wypelnij formularz podania.",
      components: [applyButton]
    });

    return;
  }

  return interaction.editReply(`🎫 Ticket utworzony: ${channel}`);
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
      footerText: "clowns.cool - transkrypt ticketu",
      callbacks: {
        resolveChannel: channelId => interaction.guild.channels.cache.get(channelId)?.name || channelId,
        resolveUser: userId => interaction.guild.members.cache.get(userId)?.user?.tag || userId,
        resolveRole: roleId => interaction.guild.roles.cache.get(roleId)?.name || roleId
      }
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

client.once(Events.ClientReady, async () => {
  console.log(`Bot uruchomiony jako ${client.user.tag}`);

  const commands = [
    new SlashCommandBuilder()
      .setName("setup")
      .setDescription("Tworzy kategorie, kanaly i panel ticketow"),

    new SlashCommandBuilder()
      .setName("panel")
      .setDescription("Wysyla panel ticketow"),

    new SlashCommandBuilder()
      .setName("warn")
      .setDescription("Nadaje ostrzezenie organizacyjne")
      .addUserOption(o =>
        o.setName("osoba")
          .setDescription("Osoba")
          .setRequired(true)
      )
      .addStringOption(o =>
        o.setName("powod")
          .setDescription("Powod ostrzezenia")
          .setRequired(true)
      ),

    new SlashCommandBuilder()
      .setName("warny")
      .setDescription("Pokazuje liczbe ostrzezen organizacyjnych")
      .addUserOption(o =>
        o.setName("osoba")
          .setDescription("Osoba")
          .setRequired(true)
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
          .setDescription("Opcjonalnie: usun tylko wiadomosci tej osoby")
          .setRequired(false)
      ),

    new SlashCommandBuilder()
      .setName("zamknij")
      .setDescription("Zamyka aktualny ticket")
  ].map(c => c.toJSON());

  const rest = new REST({ version: "10" }).setToken(TOKEN);

  try {
    await rest.put(
      Routes.applicationCommands(CLIENT_ID),
      { body: commands }
    );

    console.log("Komendy zostaly zarejestrowane globalnie.");
  } catch (err) {
    console.error("Blad rejestracji komend:", err);
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

      const messages = await setup.panel.messages.fetch({ limit: 20 }).catch(() => null);
      const exists = messages?.some(
        m => m.author.id === client.user.id && m.components.length > 0
      );

      if (!exists) {
        await sendTicketPanel(setup.panel);
      }

      return interaction.editReply(
        "Gotowe. Bot nie utworzyl ani nie zmienil zadnej roli."
      );
    }

    if (interaction.commandName === "panel") {
      if (!isStaff(interaction.member)) {
        return interaction.reply({
          content: "Ta komenda jest tylko dla administracji.",
          ephemeral: true
        });
      }

      await sendTicketPanel(interaction.channel);

      return interaction.reply({
        content: "Panel zostal wyslany.",
        ephemeral: true
      });
    }

    if (interaction.commandName === "warn") {
      if (!isStaff(interaction.member)) {
        return interaction.reply({
          content: "Ta komenda jest tylko dla administracji.",
          ephemeral: true
        });
      }

      const user = interaction.options.getUser("osoba");
      const reason = interaction.options.getString("powod");

      if (user.bot) {
        return interaction.reply({
          content: "Nie mozna nadac ostrzezenia botowi.",
          ephemeral: true
        });
      }

      await interaction.deferReply({ ephemeral: true });
      await setupGuild(interaction.guild);

      const previousWarns = await countWarnsForUser(interaction.guild, user.id);
      const warnCount = previousWarns + 1;

      let muteApplied = false;
      let muteError = null;

      if (warnCount === 3) {
        try {
          const member = await interaction.guild.members.fetch(user.id);

          if (!member.moderatable) {
            muteError = "Bot nie moze wyciszyc tej osoby. Sprawdz hierarchie rang i uprawnienie Moderowanie czlonkow.";
          } else {
            await member.timeout(
              7 * 24 * 60 * 60 * 1000,
              `3 ostrzezenia organizacyjne. Ostatni powod: ${reason}`
            );
            muteApplied = true;
          }
        } catch (err) {
          console.error("Blad automatycznego wyciszenia:", err);
          muteError = "Nie udalo sie automatycznie wyciszyc tej osoby.";
        }
      }

      await sendWarnLog(
        interaction.guild,
        user,
        interaction.user,
        reason,
        warnCount,
        muteApplied
      );

      let response = `Ostrzezenie zostalo nadane. Liczba ostrzezen: ${warnCount}/3.`;

      if (muteApplied) {
        response += " Uzytkownik zostal automatycznie wyciszony na 7 dni.";
      } else if (warnCount === 3 && muteError) {
        response += ` ${muteError}`;
      }

      return interaction.editReply(response);
    }

    if (interaction.commandName === "warny") {
      if (!isStaff(interaction.member)) {
        return interaction.reply({
          content: "Ta komenda jest tylko dla administracji.",
          ephemeral: true
        });
      }

      const user = interaction.options.getUser("osoba");
      await setupGuild(interaction.guild);

      const count = await countWarnsForUser(interaction.guild, user.id);

      const embed = new EmbedBuilder()
        .setTitle("Ostrzezenia organizacyjne")
        .addFields(
          { name: "Uzytkownik", value: `${user}`, inline: true },
          { name: "Liczba ostrzezen", value: `${count}/3`, inline: true },
          {
            name: "Automatyczna kara",
            value: count >= 3
              ? "Prog 3 ostrzezen zostal osiagniety."
              : `Do wyciszenia na 7 dni pozostalo: ${3 - count}.`,
            inline: false
          }
        )
        .setThumbnail(user.displayAvatarURL({ size: 256 }))
        .setTimestamp();

      return interaction.reply({
        embeds: [embed],
        ephemeral: true
      });
    }

    if (interaction.commandName === "clear") {
      if (!isStaff(interaction.member)) {
        return interaction.reply({
          content: "Ta komenda jest tylko dla administracji.",
          ephemeral: true
        });
      }

      if (!interaction.channel || !interaction.channel.isTextBased()) {
        return interaction.reply({
          content: "Tej komendy mozna uzyc tylko na kanale tekstowym.",
          ephemeral: true
        });
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

          // Discord nie pozwala bulk-delete wiadomosci starszych niz 14 dni.
          const fourteenDays = 14 * 24 * 60 * 60 * 1000;
          if (Date.now() - message.createdTimestamp >= fourteenDays) continue;

          if (targetUser && message.author.id !== targetUser.id) continue;

          selected.push(message);
        }

        before = batch.last()?.id;
        if (batch.size < fetchLimit) break;
      }

      if (selected.length === 0) {
        return interaction.editReply(
          targetUser
            ? `Nie znaleziono ostatnich wiadomosci uzytkownika ${targetUser} mozliwych do usuniecia.`
            : "Nie znaleziono wiadomosci mozliwych do usuniecia."
        );
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
        return interaction.editReply(
          "Nie udalo sie usunac wiadomosci. Sprawdz uprawnienie Zarzadzanie wiadomosciami."
        );
      }

      await logTo(
        interaction.guild,
        NAMES.GENERAL_LOGS,
        "Czyszczenie wiadomosci",
        [
          `Kanal: ${interaction.channel}`,
          `Administrator: ${interaction.user}`,
          `Usunieto: ${deletedCount}`,
          targetUser ? `Tylko od uzytkownika: ${targetUser}` : "Tryb: ogolny"
        ].join("\n")
      );

      return interaction.editReply(
        targetUser
          ? `Usunieto ${deletedCount} wiadomosci uzytkownika ${targetUser} z tego kanalu.`
          : `Usunieto ${deletedCount} wiadomosci z tego kanalu.`
      );
    }

    if (interaction.commandName === "zamknij") {
      if (!getTicketOwnerId(interaction.channel)) {
        return interaction.reply({
          content: "To nie jest kanal ticketu.",
          ephemeral: true
        });
      }

      return closeTicket(interaction);
    }
  }

  if (interaction.isStringSelectMenu() && interaction.customId === "ticket_type") {
    await interaction.deferReply({ ephemeral: true });
    return createTicket(interaction, interaction.values[0]);
  }

  if (interaction.isButton()) {
    if (interaction.customId === "open_application") {
      const ownerId = getTicketOwnerId(interaction.channel);

      if (interaction.user.id !== ownerId) {
        return interaction.reply({
          content: "Tylko autor ticketu moze wypelnic to podanie.",
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

      return interaction.reply({
        content: `Ticket przejal ${interaction.user}.`
      });
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
      .setTimestamp();

    await interaction.channel.send({ embeds: [embed] });

    await logTo(
      interaction.guild,
      NAMES.APPLICATION_LOGS,
      "Nowe podanie do organizacji",
      [
        `Osoba: ${interaction.user.tag}`,
        `ID: ${interaction.user.id}`,
        `Wiek: ${age}`,
        `FM: ${fm}`,
        `Ilosc godzin w FiveM: ${hours}`,
        `SS KD: ${kd}`,
        `Ticket: ${interaction.channel}`
      ].join("\n")
    );

    return interaction.reply({
      content: "Podanie zostalo wyslane.",
      ephemeral: true
    });
  }
});

client.on(Events.GuildMemberAdd, async member => {
  await logTo(
    member.guild,
    NAMES.GENERAL_LOGS,
    "Dolaczyl uzytkownik",
    `${member.user.tag} (${member.id})`
  );
});

client.on(Events.GuildMemberRemove, async member => {
  await logTo(
    member.guild,
    NAMES.GENERAL_LOGS,
    "Uzytkownik opuscil serwer",
    `${member.user.tag} (${member.id})`
  );
});

client.on(Events.MessageDelete, async message => {
  if (!message.guild || message.author?.bot) return;

  await logTo(
    message.guild,
    NAMES.GENERAL_LOGS,
    "Usunieta wiadomosc",
    [
      `Autor: ${message.author?.tag || "nieznany"}`,
      `Kanal: ${message.channel}`,
      `Tresc: ${(message.content || "brak tresci").slice(0, 1500)}`
    ].join("\n")
  );
});

client.on(Events.MessageUpdate, async (oldMessage, newMessage) => {
  if (!newMessage.guild || newMessage.author?.bot) return;
  if (oldMessage.content === newMessage.content) return;

  await logTo(
    newMessage.guild,
    NAMES.GENERAL_LOGS,
    "Edytowana wiadomosc",
    [
      `Autor: ${newMessage.author?.tag || "nieznany"}`,
      `Kanal: ${newMessage.channel}`,
      `Przed: ${(oldMessage.content || "brak").slice(0, 700)}`,
      `Po: ${(newMessage.content || "brak").slice(0, 700)}`
    ].join("\n")
  );
});

client.login(TOKEN);
