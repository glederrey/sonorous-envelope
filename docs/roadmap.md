# Roadmap

1. **Local player + server.** Web Audio player with arpeggiator, filter, LFO, drone, delay and a colour background. MCP server (stdio) with `start_session` and `set_sound` (mood axes + synth override + `final` flag), serving the player on localhost.
2. **Offline render + analysis.** numpy version of the synth, perceptual features, HSL colour, compact feedback.
3. **Listener controls.** Volume, mute, limits, consent levels, reaction buttons, reaction log returned to the model.
4. **Gestures.** First set (purr, chirp, sigh, hum, pluck, breath), with a listener switch to mute them.
5. **Mood estimate.** Heuristics for all five axes, then an Essentia model for joy and calm to compare.
6. **Final-update enforcement.** Server instructions, then a Claude Code hook.
7. **Skill.** Guidance on expression, mid-turn and final updates, reading reactions, staying subtle, respecting limits.
8. **Opt-in spectrogram.** `image_feedback` setting and `inspect` tool.
9. **Remote + mobile.** Hosted server as a claude.ai connector, server-rendered audio stream for phones, MCP Apps if supported.
