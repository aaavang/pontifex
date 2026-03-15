<div id="top"></div>

<!-- NOTES -->
<!--
*** Individual sections below can be removed if not needed
-->

<!-- PROJECT SHIELDS -->
<!--
*** We are using markdown "reference style" links for readability.
*** Reference links are enclosed in brackets [ ] instead of parentheses ( ).
*** See the bottom of this document for the declaration of the reference variables
*** for contributors-url, forks-url, etc. This is an optional, concise syntax you may use.
*** https://www.markdownguide.org/basic-syntax/#reference-style-links
-->

[![Contributors][contributors-shield]][contributors-url]
[![Forks][forks-shield]][forks-url]
[![Stargazers][stars-shield]][stars-url]
[![Issues][issues-shield]][issues-url]
[![MIT License][license-shield]][license-url]

<!-- PROJECT LOGO -->
<br />
<div align="center">
  <a href="https://github.com/rvohealth/pontifex-ui">
    <img src="public/pontifex-white.png" alt="Logo" >
  </a>

<h3 align="center">pontifex-ui</h3>

  <p align="center">
    An Next.js UI for Pontifex
  </p>
</div>

<!-- TABLE OF CONTENTS -->
<details>
  <summary>Table of Contents</summary>
  <ol>
    <li>
      <a href="#about-the-project">About The Project</a>
      <ul>
        <li><a href="#built-with">Built With</a></li>
      </ul>
    </li>
    <li>
      <a href="#getting-started">Getting Started</a>
      <ul>
        <li><a href="#installation">Installation</a></li>
      </ul>
    </li>
    <li><a href="#contributing">Contributing</a></li>
    <li><a href="#license">License</a></li>
    <li><a href="#maintainers">Maintainers</a></li>
  </ol>
</details>

<!-- ABOUT THE PROJECT -->

## About The Project

Pontifex is a self-service Service Registry coupled with Azure Active Directory as an OAuth2 provider. Users can
register applications, environments, and roles/scopes for their projects and requests access to other applications and
their roles/scopes.

<p align="right">(<a href="#top">back to top</a>)</p>

### Built With

- [Next.js](https://nextjs.org/)
- [React.js](https://reactjs.org/)

<p align="right">(<a href="#top">back to top</a>)</p>

## Development

### Prerequisites

- Node 18
  - it is recommended to use a tool like [nvm](https://github.com/nvm-sh/nvm#installing-and-updating)

### Running locally

To aid in development, you can specify environment variables in a `.env` file in the root of the project. A sample `.env` file is provided in [.env.sample](./.env.sample). You can copy this file to `.env` and modify it as needed. `.env` should never be committed to source control.

By default, the UI is configured to use nonprod pontifex-api as a backend. To run pontifex-api locally, see [pontifex-api](https://github.com/rvohealth/pontifex-api/?tab=readme-ov-file#readme) and point to it by setting `NEXT_PUBLIC_APIM_URL` as `http://127.0.0.1:7071/api`.

1. Clone the repo

   ```sh
   git clone git@github.com:rvohealth/pontifex-ui.git
   ```

2. Install packages

   ```sh
   npm install
   ```

3. Start the server

   ```shell
    npm run dev
   ```

<p align="right">(<a href="#top">back to top</a>)</p>

## Deployment

Deployment pipeline is handled by [Azure DevOps](https://dev.azure.com/rvo-optum-store/RVO-Optum-Store/_build).

Deployment to nonprod is done automatically on merge into `main`.

Deployment to production is done by creating a new tag.

<!-- CONTACT -->

## Contact

[Alex Aavang](mailto:aaavang@creditacceptance.com)

<!-- MARKDOWN LINKS & IMAGES -->
<!-- https://www.markdownguide.org/basic-syntax/#reference-style-links -->

[contributors-shield]: https://img.shields.io/github/contributors/Optum/pontifex-ui.svg?style=for-the-badge
[contributors-url]: https://github.com/Optum/pontifex-ui/graphs/contributors
[forks-shield]: https://img.shields.io/github/forks/Optum/pontifex-ui.svg?style=for-the-badge
[forks-url]: https://github.com/Optum/pontifex-ui/network/members
[stars-shield]: https://img.shields.io/github/stars/Optum/pontifex-ui.svg?style=for-the-badge
[stars-url]: https://github.com/Optum/pontifex-ui/stargazers
[issues-shield]: https://img.shields.io/github/issues/Optum/pontifex-ui.svg?style=for-the-badge
[issues-url]: https://github.com/Optum/pontifex-ui/issues
[license-shield]: https://img.shields.io/github/license/Optum/pontifex-ui.svg?style=for-the-badge
[license-url]: https://github.com/Optum/pontifex-ui/blob/master/LICENSE.txt
