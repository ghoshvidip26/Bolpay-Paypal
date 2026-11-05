import { ElevenLabsClient } from '@elevenlabs/elevenlabs-js'

const client = new ElevenLabsClient({ apiKey: process.env.ELEVEN_LABS_API_KEY })

export const useSpeechToTxt = async () => {
    const response = await fetch("https://storage.googleapis.com/eleven-public-cdn/audio/marketing/nicole.mp3");
    const audioBlob = new Blob([await response.arrayBuffer()], { type: "audio/mp3" });
    const transcription = await client.speechToText.convert({
        file: audioBlob,
        modelId: "scribe_v2", // Model to use
        tagAudioEvents: true, // Tag audio events like laughter, applause, etc.
        languageCode: "eng", // Language of the audio file. If set to null, the model will detect the language automatically.
        diarize: true,
    })
    console.log(transcription)
}

/** Transcribes a short recorded clip (used by the voice command interface). */
export async function transcribeAudio(audio: Blob): Promise<string> {
    const result = await client.speechToText.convert({
        file: audio,
        modelId: "scribe_v2",
        tagAudioEvents: false,
        diarize: false,
        // languageCode omitted so the model auto-detects the spoken language.
    })
    const r = result as { text?: string; transcripts?: { text: string }[] }
    if (r.transcripts) return r.transcripts.map((t) => t.text).join(" ")
    if (typeof r.text === "string") return r.text
    throw new Error("Unexpected transcription response (webhook mode?)")
}


const TTS_VOICE_ID = process.env.ELEVEN_LABS_VOICE_ID || "JBFqnCBsd6RMkjVDRZzb"
const TTS_MODEL_ID = process.env.ELEVEN_LABS_TTS_MODEL || "eleven_multilingual_v2"

/** Speaks a short reply. Returns an MP3 byte stream. The model auto-detects the language of the text. */
export async function synthesizeSpeech(text: string): Promise<ReadableStream<Uint8Array>> {
    return client.textToSpeech.convert(TTS_VOICE_ID, {
        text,
        modelId: TTS_MODEL_ID,
        outputFormat: "mp3_44100_64",
    })
}
