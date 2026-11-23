# NeoPrompter

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
The Operator's main window, in Edit mode or Run mode, with a native menu bar and a Button bar.
_Avoid_: Control window, dashboard

**Edit mode**:
The Operator view for preparing Scripts: the Script library and a full Script editor.
_Avoid_: Authoring mode, design mode

**Run mode**:
The Operator view for a live production: transport controls, quick text size buttons, the reading position, and Notifications. The Script is locked against typing until the Operator deliberately unlocks it for a live fix.
_Avoid_: Live mode, show mode, presenter mode

**Live view**:
In Run mode, a scaled copy of the Output showing exactly what the Talent sees, including the Reading line and Progress bar. Its top line is always the Output's top line.
_Avoid_: Preview

**Button bar**:
The row of labeled buttons under the menu bar. It always shows the mode switch and the Output switch, and the buttons in between change with the mode.
_Avoid_: Toolbar, ribbon

**Preferences**:
A separate window holding the settings, grouped by category.
_Avoid_: Settings panel, options, config

**Output**:
The clean, full-screen, text-only window the Talent reads, sent to the prompter display. It is always a 1920x1080 picture, scaled to fit the display, so the same lines wrap, space and sit in the same place whatever the monitor. The Operator can switch it on or off and choose its monitor; there is only ever one. Esc on the Output takes it out of full screen, however it got there: a full screen Output on its monitor becomes an ordinary window until it is switched Off and On again, and a window the Operator made full screen themselves goes back to its size.
_Avoid_: Prompter screen, display, program

**Notification**:
A short live message for the Operator, usually from the Producer, shown as a banner only in the Operator view and never on the Output. It disappears on its own after a set time. It may carry a Quick message color, which fills the banner.
_Avoid_: Alert, message, cue

**Quick message**:
A saved Notification text the Producer can send with one tap from the Producer page. It may have a color, one of a small fixed palette, shown on its button and on the Notification it sends. With no color it looks neutral.
_Avoid_: Canned message, macro

**Producer page**:
The web page the app serves on the local network, where the Producer sends Notifications from a phone or laptop with no install.
_Avoid_: Producer app, remote, dashboard

**Progress bar**:
A thin line along the bottom of the Output that fills with the current position in the Script. It is red unless the Operator chooses another color, and it shows no numbers.
_Avoid_: Progress indicator, timeline

**Reading line**:
A large triangle at the side of the Output that marks the line the Talent should be reading. It is red unless the Operator chooses another color. The Operator drags it up or down in the Live view to place it, and its position and color are saved in the Preset. It only marks a place; it never moves the text.
_Avoid_: Cursor, marker, indicator

**Preset**:
A named saved set of appearance settings (font size, spacing, margins, colors, reading line, mirror), for example one per Talent.
_Avoid_: Theme, profile, template

**Recent colors**:
The ten text colors the Operator used most recently, newest first, offered as swatches in the editor's Color button. They start as red, green, blue, yellow and white.
_Avoid_: Palette, color history, swatches

**Direction**:
Which way the Script is playing: forward (FWD) or back (BACK, in reverse). The Operator can set it with a middle click, playing or stopped. Otherwise it is forward whenever the Script is not playing, and a pause puts it back to forward.
_Avoid_: Reverse mode, rewind

**Screen** (as a distance):
The visible height of the Output minus one line, which is how far "back one screen" and "forward one screen" jump.
_Avoid_: Page

**Virtual shuttle**:
An on-screen copy of the ShuttleXPress (ring, jog wheel, and five buttons) in its own small window, opened from the Window menu and closed by default, so the prompter can be controlled and tested without the hardware.
_Avoid_: Simulator, emulator, mock shuttle

**Windowed Output**:
A test setting that shows the Output in an ordinary window on the Operator's screen, so the app can be tried on a single-display machine.
_Avoid_: Preview, debug mode

**Import**:
Bringing a Word file (`.doc` or `.docx`) in as a Script, keeping its structure, emphasis, and colors. Any color too hard to read on the Output, and in the editor, is replaced with a readable one when shown; the Script keeps the original color.
_Avoid_: Open, upload, convert

**Watched folder**:
One folder the Operator picks in Preferences, off until chosen. A Word file (`.doc` or `.docx`) dropped into it is Imported as a Script, at startup for files that arrived while the app was closed and while the app is running. A file that Imports is moved into an `imported` subfolder; one that fails stays where it is and the Operator is told why. A Script with a name already in the library is added alongside it under a numbered name, never over it. In Run mode, dropped files wait and are Imported when the Operator returns to Edit mode.
_Avoid_: Hot folder, inbox, drop folder
