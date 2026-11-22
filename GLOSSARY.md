# Neoprompter

A desktop teleprompter for a church live production team. One person, the Operator, runs it while others on the team send them live information.

## Language

**Operator**:
The person running the prompter during a live production. Controls scrolling, the Script, and reads Notifications.
_Avoid_: User, presenter, talent

**Talent**:
The person reading the Script off the Output.
_Avoid_: Speaker, presenter, reader

**Producer**:
The person directing the production, who sends Notifications to the Operator.
_Avoid_: Director, sender

**Script**:
The text the Talent reads, prepared in advance and loaded into the app.
_Avoid_: Document, rundown, file

**Operator view**:
The Operator's own screen, holding controls, the Script library, and Notifications.
_Avoid_: Control window, dashboard

**Output**:
The clean, full-screen, text-only window the Talent reads, sent to the prompter display.
_Avoid_: Prompter screen, display, program

**Notification**:
A short live message from the Producer, shown as a banner only in the Operator view and never on the Output. It disappears on its own after a set time.
_Avoid_: Alert, message, cue

**Producer page**:
The web page the app serves on the local network, where the Producer sends Notifications from a phone or laptop with no install.
_Avoid_: Producer app, remote, dashboard

**Progress bar**:
A thin line along the bottom of the Output that fills with the current position in the Script. It shows no numbers.
_Avoid_: Progress indicator, timeline

**Reading line**:
A small triangle at the side of the Output that marks the line the Talent should be reading.
_Avoid_: Cursor, marker, indicator

**Preset**:
A named saved set of appearance settings (font size, spacing, margins, colors, reading line, mirror), for example one per Talent.
_Avoid_: Theme, profile, template

**Screen** (as a distance):
The visible height of the Output minus one line, which is how far "back one screen" and "forward one screen" jump.
_Avoid_: Page

**Virtual shuttle**:
An on-screen copy of the ShuttleXPress (ring, jog wheel, and five buttons) in the Operator view, so the prompter can be controlled and tested without the hardware.
_Avoid_: Simulator, emulator, mock shuttle

**Windowed Output**:
A test setting that shows the Output in an ordinary window on the Operator's screen, so the app can be tried on a single-display machine.
_Avoid_: Preview, debug mode

**Import**:
Bringing a Word file (`.doc` or `.docx`) in as a Script, keeping its structure, emphasis, and colors. Any color too hard to read on the Output is replaced with the theme's text color.
_Avoid_: Open, upload, convert
