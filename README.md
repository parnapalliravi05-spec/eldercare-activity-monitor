# PRJ_62 — ElderCare Activity Monitor Website

This folder contains a complete website that can be published using GitHub Pages.

## Folder structure

```text
PRJ_62_Website_From_Zero/
├── README.md
└── docs/
    ├── index.html
    ├── styles.css
    ├── app.js
    ├── .nojekyll
```

## What this website contains

- Project introduction
- Interactive simulated activity dashboard
- Normal activity state
- Low activity / alert state
- Activity history
- System architecture
- Planned ESP32 + PIR + reed switch hardware
- All 11 supplied review screenshots
- Responsive design for laptop and mobile

## Important

This website is a static front end. GitHub Pages does not execute Python or FastAPI.

For the current project review, the dashboard uses JavaScript to simulate sensor data.

Later, the project can be connected to:

ESP32 → PIR / Reed Switch → Wi-Fi → FastAPI → Database / ML → Dashboard → Notification

## Local test

Open:

`docs/index.html`

in a browser.

## GitHub Pages

Create a GitHub repository, upload the contents, then:

1. Open repository `Settings`
2. Open `Pages`
3. Under `Build and deployment`, choose `Deploy from a branch`
4. Branch: `main`
5. Folder: `/docs`
6. Click `Save`

The public website will normally be:

`https://YOUR-USERNAME.github.io/YOUR-REPOSITORY/`

## Suggested project explanation

> This is the software prototype of PRJ_62. The system receives activity parameters such as movement, door events and appliance activity. For the current review, simulated sensor input is used to demonstrate the complete software workflow. The next phase is to replace the simulated input with ESP32-based physical sensors and connect the dashboard to the FastAPI backend and ML model.

## Demo

Click:

- Simulate Normal
- Simulate Low Activity
- Calculate

The risk calculation in `app.js` is only a demonstration heuristic. It is not a clinical diagnosis or validated medical model.


## Important design note

The supplied screenshots were used only as reference material to understand the
project requirements, review plan, dashboard idea, architecture, alert flow and
future hardware integration. The screenshots themselves are NOT displayed in
the website.
