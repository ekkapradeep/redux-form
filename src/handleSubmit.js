// @flow
import { Iterable } from 'immutable'
import isPromise from 'is-promise'
import type { Dispatch } from 'redux'
import type { Props } from './createReduxForm'

type SubmitFunction = {
  (values: any, dispatch: Dispatch<*>, props: Object): any
}

const isSubmissionError = error => error && error.name === 'SubmissionError'
const mergeErrors = ({ asyncErrors, syncErrors }) =>
  asyncErrors && Iterable.isIterable(asyncErrors)
    ? asyncErrors.merge(syncErrors).toJS()
    : { ...asyncErrors, ...syncErrors }

const handleSubmit = (
  submit: SubmitFunction,
  props: Props,
  valid: boolean,
  asyncValidate: Function,
  fields: string[]
) => {
  const {
    dispatch,
    onSubmitFail,
    onSubmitSuccess,
    startSubmit,
    stopSubmit,
    setSubmitFailed,
    setSubmitSucceeded,
    syncErrors,
    asyncErrors,
    touch,
    values,
    persistentSubmitErrors
  } = props

  touch(...fields) // mark all fields as touched

  if (valid || persistentSubmitErrors) {
    const doSubmit = () => {
      let result
      try {
        result = submit(values, dispatch, props)
      } catch (submitError) {
        const error = isSubmissionError(submitError)
          ? submitError.errors
          : undefined
        stopSubmit(error)
        setSubmitFailed(...fields)
        if (onSubmitFail) {
          onSubmitFail(error, dispatch, submitError, props)
        }
        if (error || onSubmitFail) {
          // if you've provided an onSubmitFail callback, don't re-throw the error
          return error
        } else {
          throw submitError
        }
      }
      if (isPromise(result)) {
        startSubmit()
        return result.then(
          submitResult => {
            stopSubmit()
            setSubmitSucceeded()
            if (onSubmitSuccess) {
              onSubmitSuccess(submitResult, dispatch, props)
            }
            return submitResult
          },
          submitError => {
            const error = isSubmissionError(submitError)
              ? submitError.errors
              : undefined
            stopSubmit(error)
            setSubmitFailed(...fields)
            if (onSubmitFail) {
              onSubmitFail(error, dispatch, submitError, props)
            }
            if (error || onSubmitFail) {
              // if you've provided an onSubmitFail callback, don't re-throw the error
              return error
            } else {
              throw submitError
            }
          }
        )
      } else {
        setSubmitSucceeded()
        if (onSubmitSuccess) {
          onSubmitSuccess(result, dispatch, props)
        }
      }
      return result
    }

    const asyncValidateResult = asyncValidate && asyncValidate()
    if (asyncValidateResult) {
      return asyncValidateResult
        .then(asyncErrors => {
          if (asyncErrors) {
            throw asyncErrors
          }
          return doSubmit()
        })
        .catch(asyncErrors => {
          setSubmitFailed(...fields)
          if (onSubmitFail) {
            onSubmitFail(asyncErrors, dispatch, null, props)
          }
          return Promise.reject(asyncErrors)
        })
    } else {
      return doSubmit()
    }
  } else {
    setSubmitFailed(...fields)
    const errors = mergeErrors({ asyncErrors, syncErrors })
    if (onSubmitFail) {
      onSubmitFail(errors, dispatch, null, props)
    }
    return errors
  }
}

export default handleSubmit
