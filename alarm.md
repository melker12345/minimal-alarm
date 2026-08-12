## Alarm app
Build a better alarm app for mobile.

The main issue i want to solve are two fold:
1. currently im able to turn off the alarm on lock screen (I do not have to unlock phone).
2. I set like 6 alarm all in 5-15 minute intervall before the time I need to be awake. manageing this is a mess.

This should be a "MVP" version of an alarm app, add time to ring the alarm, turn it of by entering the app and manually turning it off, we should have 2 "pages" one for viewing (and quickly manage alarms) one for creating a new alarm.

The app should have a polished, modern visual design inspired by high-quality apps such as Brilliant. It should feel calm, clear, and premium without becoming bloated. Prioritise strong hierarchy, excellent spacing, simple interactions, subtle motion, and a very fast path to creating and managing alarms. The interface must work well on both small and large phone screens.

We should allow for grouping, so create group -> add new alarm, then the user can simply toggle one group on 
instead of having to toggle many alarms, there should be a opption to select amount of alarms with a spacing 

so when user creates an group they should have an opption to manually add alarms and also an option to select time 
say 05:00 then select amount and spacing, so if the user sets time say 05:00 then they select 5 for count and 10min 
for spacing we shuold create a total of 5 alarms that ring 05:00, 04:50, 04:40, 04:30, 04:20. 

There should be a setting for "require manuall disabeling of alarm" (which means the user have to open the app to disable it)

The user should optionally be able to connect a Philips Hue bridge and select lights to turn on when the alarm rings. The lights should turn on in sync with the alarm, independently of the phone ringtone. Hue integration must be optional and should never prevent the phone alarm from ringing if the bridge, network, or Hue connection is unavailable.

We should allow the user to set an alarm that rings for selected days of the week

Ringtone ought to be the default of the phone, but let's have a selection of different kinds:
- one intence
- one calm
- one ramp up,
- one short but loud


Should opt for high perforiming and reliability whilst keeping it minimal.
