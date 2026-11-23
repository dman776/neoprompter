# Using a ShuttleXPress

NeoPrompter does not talk to the ShuttleXPress itself yet (the Virtual shuttle is the on-screen copy). The way to use the real device today is its own driver software, which turns the device's motions into keystrokes. NeoPrompter sees those as ordinary keys, so you tell it which keys with **Key bindings**.

## Set it up

1. In the driver software, give each motion you want a key. Pick keys nothing else uses: F-keys or numpad keys suit well. A key with Cmd or Ctrl that the NeoPrompter menu uses (such as Cmd+N) is refused.
2. In NeoPrompter, open Preferences, Controls, Keyboard.
3. For each action, press **Add key**, then press the key the driver sends. It is saved at once. If another action already has that key, you are asked whether to move it.
4. To check the driver without running a Script, press its buttons with the Preferences window focused. The line under the keys names the last key pressed and the action it runs, or says it is not bound.

Reset to defaults puts back the keys the prompter always had.

## What works

- Buttons: any action can be given a key, and a button the driver maps to that key runs it.
- Run mode only: Key bindings work in the Operator view's Run mode with the Script locked. They do nothing in Edit mode, with the Script unlocked, or while a text field has focus. NeoPrompter must be the app in front, because a driver sends its keys to the app that has focus.
- A key is a tap. Only Speed up and Speed down repeat when a key is held (or the driver repeats it).

## What does not work

- The ring and the jog wheel cannot be bound. The ring holds the text moving while you hold it and stops on release, and a key press has no release. For speed, give a pair of driver keys (one for each turn direction of the jog wheel, if the driver can) to Speed up and Speed down.
- Shift with a Speed up or Speed down key makes a bigger step, as with the arrow keys.

## What was tested

- Tested: Key bindings with synthetic key presses, in the unit tests and in the running app (`e2e/key-bindings.e2e.test.ts`): a saved or captured key runs its action in Run mode and does nothing in Edit mode, and the Preferences readout names a pressed key.
- Not tested: a real ShuttleXPress, and any version of the Contour driver software. Nothing here has been run against the device. In particular, whether your driver version sends a plain key tap, sends it to the app in front, or repeats it for a held button is not confirmed.
- What the driver is reported to do, from its manual and a third party's guide (not tried here): it sends keystrokes to whichever program is in front, and on macOS its driver extension has to be allowed in System Settings before the device does anything. See the [Contour ShuttleXpress manual](https://manualmachine.com/contourdesign/shuttlexpress/21647594-product-manual) and [Contour's product page](https://contourdesign.com/products/shuttle-xpress).

If the Last key pressed line shows nothing when you press a button, the keys are not reaching NeoPrompter: check the driver, its permissions and which app is in front.
