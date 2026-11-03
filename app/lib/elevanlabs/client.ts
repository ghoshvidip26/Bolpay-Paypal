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