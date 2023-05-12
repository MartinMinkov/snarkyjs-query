export {
  CatchAndPrettifyStacktraceForAllMethods,
  CatchAndPrettifyStacktrace,
  prettifyStacktrace,
  assert,
};

/**
 * A class decorator that applies the CatchAndPrettifyStacktrace decorator function
 * to all methods of the target class.
 *
 * @param constructor - The target class constructor.
 */
function CatchAndPrettifyStacktraceForAllMethods<
  T extends { new (...args: any[]): {} }
>(constructor: T) {
  // Iterate through all properties (including methods) of the class prototype
  for (const propertyName of Object.getOwnPropertyNames(
    constructor.prototype
  )) {
    // Skip the constructor
    if (propertyName === 'constructor') continue;

    // Get the property descriptor
    const descriptor = Object.getOwnPropertyDescriptor(
      constructor.prototype,
      propertyName
    );

    // Check if the property is a method
    if (descriptor && typeof descriptor.value === 'function') {
      // Apply the CatchAndPrettifyStacktrace decorator to the method
      CatchAndPrettifyStacktrace(
        constructor.prototype,
        propertyName,
        descriptor
      );

      // Update the method descriptor
      Object.defineProperty(constructor.prototype, propertyName, descriptor);
    }
  }
}

/**
 * A decorator function that wraps the target method with error handling logic.
 * It catches errors thrown by the method, prettifies the stack trace, and then
 * rethrows the error with the updated stack trace.
 *
 * @param _target - The target object.
 * @param _propertyName - The name of the property being decorated.
 * @param descriptor - The property descriptor of the target method.
 */
function CatchAndPrettifyStacktrace(
  _target: any,
  _propertyName: string,
  descriptor: PropertyDescriptor
) {
  const originalMethod = descriptor.value;
  descriptor.value = function (...args: any[]) {
    try {
      const result = originalMethod.apply(this, args);
      return handleResult(result);
    } catch (error) {
      const prettyStacktrace = prettifyStacktrace(error);
      if (prettyStacktrace && error instanceof Error) {
        error.stack = prettyStacktrace;
      }
      throw error;
    }
  };
}

/**
 * Handles the result of a function call, wrapping a Promise with error handling logic
 * that prettifies the stack trace before rethrowing the error. For non-Promise results,
 * the function returns the result unchanged. This function is intended for internal usage
 * and not exposed to users.
 *
 * @param result - The result of the function call, which can be a Promise or any other value.
 * @returns A Promise with error handling logic for prettifying the stack trace, or the original result if it's not a Promise.
 */
function handleResult(result: any) {
  if (result instanceof Promise) {
    return result.catch((error: Error) => {
      const prettyStacktrace = prettifyStacktrace(error);
      if (prettyStacktrace && error instanceof Error) {
        error.stack = prettyStacktrace;
      }
      throw error;
    });
  }
  return result;
}

/**
 * A list of keywords used to filter out unwanted lines from the error stack trace.
 */
const lineRemovalKeywords = [
  'snarky_js_node.bc.cjs',
  '/builtin/',
  'CatchAndPrettifyStacktrace', // Decorator name to remove from stacktrace (covers both class and method decorator)
] as const;

/**
 * Prettifies the stack trace of an error by removing unwanted lines and trimming paths.
 *
 * @param error - The error object with a stack trace to prettify.
 * @returns The prettified stack trace as a string or undefined if the error is not an instance of Error or has no stack trace.
 */
function prettifyStacktrace(error: unknown): string | undefined {
  if (!(error instanceof Error) || !error.stack) return undefined;

  const stacktrace = error.stack;
  const stacktraceLines = stacktrace.split('\n');
  const newStacktrace: string[] = [];

  for (let i = 0; i < stacktraceLines.length; i++) {
    const shouldRemoveLine = lineRemovalKeywords.some((lineToRemove) =>
      stacktraceLines[i].includes(lineToRemove)
    );
    if (shouldRemoveLine) {
      continue;
    }
    const trimmedLine = trimPaths(stacktraceLines[i]);
    newStacktrace.push(trimmedLine);
  }
  return newStacktrace.join('\n');
}

/**
 * Trims paths in the stack trace line based on whether it includes 'snarkyjs' or 'opam'.
 *
 * @param stacktracePath - The stack trace line containing the path to trim.
 * @returns The trimmed stack trace line.
 */
function trimPaths(stacktracePath: string) {
  const includesSnarkyJS = stacktracePath.includes('snarkyjs');
  if (includesSnarkyJS) {
    return trimSnarkyJSPath(stacktracePath);
  }

  const includesOpam = stacktracePath.includes('opam');
  if (includesOpam) {
    return trimOpamPath(stacktracePath);
  }

  const includesWorkspace = stacktracePath.includes('workspace_root');
  if (includesWorkspace) {
    return trimWorkspacePath(stacktracePath);
  }

  return stacktracePath;
}

/**
 * Trims the 'snarkyjs' portion of the stack trace line's path.
 *
 * @param stacktraceLine - The stack trace line containing the 'snarkyjs' path to trim.
 * @returns The stack trace line with the trimmed 'snarkyjs' path.
 */
function trimSnarkyJSPath(stacktraceLine: string) {
  const fullPath = getDirectoryPath(stacktraceLine);
  if (!fullPath) {
    return stacktraceLine;
  }
  const snarkyJSIndex = fullPath.indexOf('snarkyjs');
  if (snarkyJSIndex === -1) {
    return stacktraceLine;
  }

  // Grab the text before the parentheses as the prefix
  const prefix = stacktraceLine.slice(0, stacktraceLine.indexOf('(') + 1);
  // Grab the text including and after the snarkyjs path
  const updatedPath = fullPath.slice(snarkyJSIndex);
  return `${prefix}${updatedPath})`;
}

/**
 * Trims the 'opam' portion of the stack trace line's path.
 *
 * @param stacktraceLine - The stack trace line containing the 'opam' path to trim.
 * @returns The stack trace line with the trimmed 'opam' path.
 */
function trimOpamPath(stacktraceLine: string) {
  const fullPath = getDirectoryPath(stacktraceLine);
  if (!fullPath) {
    return stacktraceLine;
  }
  const opamIndex = fullPath.indexOf('opam');
  if (opamIndex === -1) {
    return stacktraceLine;
  }

  const updatedPathArray = fullPath.slice(opamIndex).split('/');
  const libIndex = updatedPathArray.lastIndexOf('lib');
  if (libIndex === -1) {
    return stacktraceLine;
  }

  // Grab the text before the parentheses as the prefix
  const prefix = stacktraceLine.slice(0, stacktraceLine.indexOf('(') + 1);
  // Grab the text including and after the opam path, removing the lib directory
  const trimmedPath = updatedPathArray.slice(libIndex + 1);
  // Add the ocaml directory to the beginning of the path
  trimmedPath.unshift('ocaml');
  return `${prefix}${trimmedPath.join('/')})`;
}

/**
 * Trims the 'workspace_root' portion of the stack trace line's path.
 *
 * @param stacktraceLine - The stack trace line containing the 'workspace_root' path to trim.
 * @returns The stack trace line with the trimmed 'workspace_root' path.
 */
function trimWorkspacePath(stacktraceLine: string) {
  const fullPath = getDirectoryPath(stacktraceLine);
  if (!fullPath) {
    return stacktraceLine;
  }
  const workspaceIndex = fullPath.indexOf('workspace_root');
  if (workspaceIndex === -1) {
    return stacktraceLine;
  }

  const updatedPathArray = fullPath.slice(workspaceIndex).split('/');
  const prefix = stacktraceLine.slice(0, stacktraceLine.indexOf('(') + 1);
  const trimmedPath = updatedPathArray.slice(workspaceIndex);
  return `${prefix}${trimmedPath.join('/')})`;
}

/**
 * Extracts the directory path from a stack trace line.
 *
 * @param stacktraceLine - The stack trace line to extract the path from.
 * @returns The extracted directory path or undefined if not found.
 */
function getDirectoryPath(stacktraceLine: string) {
  // Regex to match the path inside the parentheses (e.g. (/home/../snarkyjs/../*.ts))
  const fullPathRegex = /\(([^)]+)\)/;
  const matchedPaths = stacktraceLine.match(fullPathRegex);
  if (matchedPaths) {
    return matchedPaths[1];
  }
}

/**
 * An error that was assumed cannot happen, and communicates to users that it's not their fault but an internal bug.
 */
function Bug(message: string) {
  return Error(
    `${message}\nThis shouldn't have happened and indicates an internal bug.`
  );
}
/**
 * Make an assertion. When failing, this will communicate to users it's not their fault but indicates an internal bug.
 */
function assert(condition: boolean, message = 'Failed assertion.') {
  if (!condition) throw Bug(message);
}
