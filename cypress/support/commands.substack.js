const sep = '❤️' + '-'.repeat(25)

Cypress.Commands.add('loginToSubstack', (email, password) => {
    cy.session(email, () => {
        // substack sign-in url
        cy.visit(Cypress.config('urls').substackSignin)
        // enter login credentials into the UI
        cy.get('input[type="email"]').type(email)
        cy.get('a:contains("sign in with password")').click()
        cy.get('input[type="password"]').type(password)
        cy.get('button:contains("Sign in")').click()
        // Now, you should be logged in
        cy.waitUntil(
            () =>
                cy
                    .url()
                    .then((url) =>
                        url.includes(Cypress.config('urls').substack)
                    ),
            {
                timeout: 30000,
                interval: 1000,
            }
        ).then(() => {
            cy.waitForPageToLoad()
        })
    })
})

Cypress.Commands.add('navigateToDashboard', () => {
    let msg
    cy.url().then((url) => {
        if (url === '/publish') {
            // you're already there
            msg = `Already on ${url}`
        } else {
            // You have to navigate
            msg = `Navigating from URL: ${url}`
            cy.visit('/publish')
            // Wait until url
            cy.waitUntil(() =>
                cy.url().then((new_url) => {
                    msg += `\nurl is now ${new_url}`
                    return new_url.endsWith('/publish')
                })
            ).then(() => {
                // Wait for page to load
                cy.waitForPageToLoad()
                // Then log
                cy.log(sep)
                cy.log(msg)
                cy.log(sep)
            })
        }
    })
})

Cypress.Commands.add(
    'deleteSubstackPost',
    ({ title = null, id = null, dryRun = false } = {}) => {
        // The post id
        let postID

        if (id > 0) {
            // Delete by id
            postID = Number(id)
            cy.visit(`/publish/post/${id}`)
        } else {
            // Delete by title
            // Navigate
            cy.navigateToDashboard()
            // Locate the post that has
            cy.get(
                `.drafts li a[href^="/publish/post/"]:contains("${title}"):first`
            ).then((link) => {
                let href = Cypress.$(link).attr('href')
                postID = Number(href.split('/').pop())
                // Visit the POST's page in order to delete it
                cy.visit(href)
            })
        }

        // Assert the post id is in the url
        cy.url().should('contain', postID)
        cy.waitForPageToLoad()
        // Click on the POST's settings button
        cy.get('[data-testid="settings-button"]').click()
        // The modal should be visible
        cy.get('.modal-content')
            .should('be.visible')
            .and('contain', 'Post Settings')
        if (dryRun === false) {
            // Click the Delete Post button
            cy.get('button:contains("Delete Post")')
                .scrollIntoView()
                .click({ force: true })
        } else {
            // Cancel out
            cy.get('button[data-testid="close-modal"]:first').click({
                force: true,
            })
        }
        // Always...
        cy.navigateToDashboard()
        // Then confirm you're back on the dashboard
        cy.waitUntil(() => cy.url().then((url) => url.endsWith('/publish')), {
            timeout: 30000,
            interval: 1000,
        })
    }
)

Cypress.Commands.add('findSubstackPostsByTitle', (title = null) => {
    if (!title || typeof title !== 'string') {
        return []
    }

    // We're good
    let url = '/api/v1/drafts?filter=draft&offset=0'
    let needle = title.toLowerCase().trim()
    // Request drafts
    cy.request(url)
        .its('body')
        .then((r) => {
            // Match against needle
            let matches = r.filter(
                (item) => item.draft_title.toLowerCase().trim() === needle
            )
            return matches
        })
})

Cypress.Commands.add('waitForPresence', () => {
    cy.wait('@presence').then((xhr) => {
        const { state, response } = xhr
        expect(state).to.eq('Complete')
        expect(response.statusCode).to.eq(200)
        expect(response.body).to.exist
        cy.log(`🇺🇸 Presence!`)
        console.log(JSON.stringify(response.body, undefined, 2))
    })
})

Cypress.Commands.add('toggleAuthor', (author = 'Willenbring') => {
    // Assume you're on the post page
    cy.get('[data-testid="user-selector"]').then((user_btn) => {
        let currentUser = Cypress.$(user_btn).find('.selected-user-name').text()
        if (!currentUser.includes(author)) {
            // Log the current user
            cy.log(currentUser).then(() => {
                // Remove this user
                cy.get(user_btn).find('.remove-user-link').click()
                cy.get('.selected-user-name:contains("Choose author")')
                    .should('be.visible')
                    .then(() => {
                        // Click add
                        cy.get('.user-selector-row.selected a').click()
                        cy.get(
                            `.dropdown-menu.active a.new-user-link:contains("${author}")`
                        ).click({ force: true })
                    })
                    .then(() => {
                        // Now, the correct author should be visible
                        cy.get(
                            `.user-selector-row.selected .selected-user-name:contains("${author}")`
                        ).should('be.visible')
                    })
            })
        } else {
            cy.log('❤️ Current user is good to go!')
        }
    })
})

Cypress.Commands.add(
    'createSubstackPost',
    ({
        title = 'Test',
        subtitle = 'Test',
        htmlContent = null,
        textContent = null,
    } = {}) => {
        // Assume you're on the dashboard already
        // Click new post
        cy.navigateToDashboard()
        cy.get('.drafts a:contains("New post")').click({ force: true })
        // Assert on url
        cy.url().should('contain', '/publish/post?type=newsletter')
        // Very first thing... toggle the author
        cy.toggleAuthor().then(() => {
            // Title
            cy.get('#post-title').type(title)
            // Subtitle
            cy.get('textarea[placeholder*="Enter subtitle"]').type(subtitle)

            // Body - Set the html
            cy.get('[data-testid="editor"]').invoke('html', htmlContent)

            // Wait for the xhr
            cy.waitForPresence()
        })
    }
)
