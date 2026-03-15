export interface User {
    firstName: string
    lastName: string
    email: string
    isAuthenticated: boolean
}

const LS_USER_ID = 'next-app-user'

type UserStore = {
    get(): User
    set(user: User): void
}

let defaultUser: User = {
    firstName: '',
    lastName: '',
    email: '',
    isAuthenticated: false
}

// NOTE: this solution can be replaced by a state management solution like Redux
export const userStore: UserStore = {
    get: (): User => {
        if (typeof window !== 'undefined') {
            const lsu = localStorage.getItem(LS_USER_ID)

            if (!lsu) {
                return defaultUser
            }

            return JSON.parse(lsu)
        }

        return defaultUser
    },
    set: (user: User): void => {
        if (typeof window !== 'undefined') {
            localStorage.setItem(LS_USER_ID, JSON.stringify(user))
            return
        }

        defaultUser = user
    }
}
