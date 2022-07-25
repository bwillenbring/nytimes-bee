// ***********************************************
// This example commands.js shows you how to
// create various custom commands and overwrite
// existing commands.
//
// For more comprehensive examples of custom
// commands please read more here:
// https://on.cypress.io/custom-commands
// ***********************************************
//
//
// -- This is a parent command --
// Cypress.Commands.add('login', (email, password) => { ... })
//
//
// -- This is a child command --
// Cypress.Commands.add('drag', { prevSubject: 'element'}, (subject, options) => { ... })
//
//
// -- This is a dual command --
// Cypress.Commands.add('dismiss', { prevSubject: 'optional'}, (subject, options) => { ... })
//
//
// -- This will overwrite an existing command --
// Cypress.Commands.overwrite('visit', (originalFn, url, options) => { ... })

import 'cypress-wait-until'
import dayjs from 'dayjs'

Cypress.Commands.add('waitForPageToLoad', () => {
    cy.waitUntil(() => cy.document().its('readyState').should('eq', 'complete'))
    cy.log('Loaded!')
})

Cypress.Commands.add('getTimestamp', (date = dayjs()) => {
    // Sun. 1 July, 2022
    // See dayjs docs here: https://day.js.org/docs/en/display/format
    const dateFormat = 'ddd. D MMMM, YYYY'
    return dayjs(date).format(dateFormat)
})
