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
