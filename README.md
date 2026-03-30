# Professor AI - Embeddable Tutor Widget

This repository contains the lightweight, embeddable frontend for the Ask Tetr SaaS platform. It is designed to be injected into any Learning Management System (LMS) such as Canvas, Moodle, or Blackboard to provide students with an instant, context-aware AI tutor.

## Architecture Overview

Unlike traditional Single Page Applications (SPAs), this project is built as a highly encapsulated Web Component. 

* **Shadow DOM Encapsulation:** The React application mounts inside a Shadow DOM. This guarantees zero CSS conflicts with the host LMS and prevents our Tailwind utility classes from leaking into the parent page.
* **Context Injection:** The widget operates without a login screen or manual course selection UI. It relies entirely on a secure context payload passed by the host environment upon initialization.
* **Dynamic Theming:** Brand colors and logos are fetched at runtime and applied via CSS custom properties, allowing every college to have a uniquely branded widget.

## Development Setup

This project uses Bun for dependency management.

1. Install dependencies:
   ```bash
   bun install
