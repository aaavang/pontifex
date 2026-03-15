export function wrapPromise<T>(promise) {
    let status = "loading"
    let result
    let suspender = promise().then(
        (data) => {
            status = "success"
            result = data
        },
        (error) => {
            status = "error"
            result = error
        }
    )

    return {
        read(): T {
            if (status === "loading") {
                throw suspender
            } else if (status === "error") {
                throw result
            } else if (status === "success") {
                return result as T
            }
        },
    }
}