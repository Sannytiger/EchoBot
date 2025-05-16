/**
 * Calculator utility for the Discord bot
 * Handles basic mathematical expressions
 */

// Define error messages
const ERROR_INVALID_EXPRESSION = "Sorry, I couldn't understand that expression. Try something like '2 + 2' or '5 * 10'.";
const ERROR_DIVISION_BY_ZERO = "I can't divide by zero! That's not allowed in this universe.";
const ERROR_TOO_COMPLEX = "That expression is too complex for me to handle.";

/**
 * Evaluates a basic mathematical expression
 * Supports addition, subtraction, multiplication, division, and parentheses
 * 
 * @param expression The mathematical expression to evaluate
 * @returns The result of the calculation or an error message
 */
export function calculate(expression: string): { result: number | null; error: string | null } {
  try {
    // Remove whitespace and validate input
    const sanitizedExpression = expression.replace(/\s+/g, '');
    
    // Check for invalid characters (only allow numbers, basic operators, and parentheses)
    if (!/^[0-9+\-*/().]+$/.test(sanitizedExpression)) {
      return { result: null, error: ERROR_INVALID_EXPRESSION };
    }
    
    // Basic security check - limit expression length
    if (sanitizedExpression.length > 100) {
      return { result: null, error: ERROR_TOO_COMPLEX };
    }
    
    // Check for division by zero
    if (/\/\s*0/.test(sanitizedExpression)) {
      return { result: null, error: ERROR_DIVISION_BY_ZERO };
    }
    
    // Parse and evaluate the expression safely
    const result = evaluateExpression(sanitizedExpression);
    
    // Format the result (handle floating point precision)
    const formattedResult = isFinite(result) ? 
      (Number.isInteger(result) ? result : parseFloat(result.toFixed(6))) : 
      null;
    
    // Return the result or error
    return {
      result: formattedResult,
      error: formattedResult === null ? ERROR_INVALID_EXPRESSION : null
    };
  } catch (error) {
    console.error('Error evaluating expression:', error);
    return { result: null, error: ERROR_INVALID_EXPRESSION };
  }
}

/**
 * Evaluates an expression using a recursive descent parser
 * Handles basic arithmetic operations with proper precedence
 * 
 * @param expression The sanitized expression to evaluate
 * @returns The calculated result
 */
function evaluateExpression(expression: string): number {
  let pos = 0;
  
  function parseExpression(): number {
    let left = parseTerm();
    
    while (pos < expression.length) {
      const char = expression[pos];
      
      if (char === '+') {
        pos++;
        left += parseTerm();
      } else if (char === '-') {
        pos++;
        left -= parseTerm();
      } else {
        break;
      }
    }
    
    return left;
  }
  
  function parseTerm(): number {
    let left = parseFactor();
    
    while (pos < expression.length) {
      const char = expression[pos];
      
      if (char === '*') {
        pos++;
        left *= parseFactor();
      } else if (char === '/') {
        pos++;
        const divisor = parseFactor();
        if (divisor === 0) {
          throw new Error('Division by zero');
        }
        left /= divisor;
      } else {
        break;
      }
    }
    
    return left;
  }
  
  function parseFactor(): number {
    if (expression[pos] === '(') {
      pos++; // Skip '('
      const result = parseExpression();
      
      if (expression[pos] === ')') {
        pos++; // Skip ')'
      } else {
        throw new Error('Missing closing parenthesis');
      }
      
      return result;
    }
    
    // Parse a number
    let start = pos;
    while (
      pos < expression.length && 
      ((expression[pos] >= '0' && expression[pos] <= '9') || expression[pos] === '.')
    ) {
      pos++;
    }
    
    if (start === pos) {
      throw new Error('Expected a number');
    }
    
    return parseFloat(expression.substring(start, pos));
  }
  
  const result = parseExpression();
  
  if (pos !== expression.length) {
    throw new Error('Unexpected character');
  }
  
  return result;
}

/**
 * Formats the calculation result into a human-readable message
 * 
 * @param expression The original expression
 * @param result The calculation result or null if there was an error
 * @param error The error message or null if calculation was successful
 * @returns A formatted message to display to the user
 */
export function formatCalculationResult(
  expression: string,
  result: number | null,
  error: string | null
): string {
  if (error) {
    return `📝 **Expression:** \`${expression}\`\n❌ **Error:** ${error}`;
  }
  
  return `📝 **Expression:** \`${expression}\`\n✅ **Result:** \`${result}\``;
}
