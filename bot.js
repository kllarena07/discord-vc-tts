const { Client, GatewayIntentBits, ActivityType } = require("discord.js");
const {
  joinVoiceChannel,
  createAudioPlayer,
  createAudioResource,
  getVoiceConnection,
} = require("@discordjs/voice");
const axios = require("axios");
const { Readable } = require("stream");

require("dotenv").config();

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;
const ELEVENLABS_VOICE_ID = process.env.ELEVENLABS_VOICE_ID;
const ELEVENLABS_MODEL_ID = process.env.ELEVENLABS_MODEL_ID;
const DISCORD_BOT_TOKEN = process.env.DISCORD_BOT_TOKEN;
const ALLOWED_USER_ID = process.env.ALLOWED_USER_ID;
const STABILITY = process.env.STABILITY;
const SIMILARITY_BOOST = process.env.SIMILARITY_BOOST;

let isListening = false;

client.once("ready", () => {
  console.log(`Logged in as ${client.user.tag}`);
  client.user.setActivity("messages", { type: ActivityType.Listening });
});

client.on("messageCreate", async (message) => {
  if (message.author.bot) return;

  if (message.content === "!join" && message.author.id === ALLOWED_USER_ID) {
    const voiceChannel = message.member.voice.channel;
    if (!voiceChannel) {
      return message.reply(
        "You need to be in a voice channel to use this command.",
      );
    }
    await joinVoiceChannel({
      channelId: voiceChannel.id,
      guildId: voiceChannel.guild.id,
      adapterCreator: voiceChannel.guild.voiceAdapterCreator,
    });
    isListening = true;
    message.reply("Joined the voice channel and started listening!");
  }

  if (message.content === "!scream" && message.author.id === ALLOWED_USER_ID) {
    const connection = getVoiceConnection(message.guild.id);
    if (connection) {
      const resource = createAudioResource("scream.wav");
      const player = createAudioPlayer();
      connection.subscribe(player);
      player.play(resource);
      message.reply("Playing scream sound!");
    } else {
      message.reply("I need to be in a voice channel first. Use !join");
    }
  }

  if (message.content === "!leave" && message.author.id === ALLOWED_USER_ID) {
    const connection = getVoiceConnection(message.guild.id);
    if (connection) {
      connection.destroy();
      isListening = false;
      message.reply("Left the voice channel and stopped listening!");
    } else {
      message.reply("I'm not in a voice channel.");
    }
  }

  if (
    isListening &&
    message.author.id === ALLOWED_USER_ID &&
    message.content !== "!scream"
  ) {
    const connection = getVoiceConnection(message.guild.id);
    if (connection) {
      try {
        const response = await axios({
          method: "POST",
          url: `https://api.elevenlabs.io/v1/text-to-speech/${ELEVENLABS_VOICE_ID}`,
          headers: {
            Accept: "audio/mpeg",
            "xi-api-key": ELEVENLABS_API_KEY,
            "Content-Type": "application/json",
          },
          data: {
            text: message.content,
            model_id: ELEVENLABS_MODEL_ID,
            voice_settings: {
              stability: STABILITY,
              similarity_boost: SIMILARITY_BOOST,
            },
          },
          responseType: "arraybuffer",
        });

        const audioBuffer = Buffer.from(response.data);
        const audioStream = Readable.from(audioBuffer);
        const resource = createAudioResource(audioStream);
        const player = createAudioPlayer();
        connection.subscribe(player);
        player.play(resource);

        console.log(`Speaking: ${message.content}`);
      } catch (error) {
        console.error("Error generating speech:", error);
        message.reply("An error occurred while generating speech.");
      }
    }
  }
});

client.login(DISCORD_BOT_TOKEN);
