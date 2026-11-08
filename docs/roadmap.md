# Roadmap

1. **Foundations.** Next.js app on Vercel, Supabase project (tables, Row Level Security, Realtime), login with Supabase Auth.
2. **OAuth for the connector.** Supabase OAuth 2.1 server with dynamic client registration, login and consent page, protected resource metadata and token validation on `/api/mcp`. Test by adding the connector in claude.ai.
3. **First tools + player.** `start_session` and `set_sound` (mood axes + synth override + `final` flag) with the usage guidance in the server instructions. Session page with the Web Audio player (arpeggiator, filter, LFO, drone, delay) and colour background, updated through Realtime.
4. **Analysis + feedback.** Python function with the numpy synth, perceptual features, HSL colour, compact feedback.
5. **Listener controls.** Volume, mute, limits, consent levels, reaction buttons, reaction log returned to the model.
6. **Gestures.** First set (purr, chirp, sigh, hum, pluck, breath), with a switch to mute them.
7. **Mood estimate.** Heuristics for all five axes, then an Essentia model for joy and calm to compare.
8. **Several listeners.** Invites, guest links, listener roles, labelled reactions.
9. **Final-update enforcement in Claude Code.** A hook that checks for the final call.
10. **Opt-in spectrogram.** `image_feedback` setting and `inspect` tool.
11. **Mobile.** Server-rendered audio stream on an always-on host; MCP Apps player if the mobile app supports it.
