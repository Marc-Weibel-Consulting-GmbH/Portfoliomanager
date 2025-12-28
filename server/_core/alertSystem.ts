/**
 * Alert System
 * 
 * Monitors stock metrics and triggers notifications when thresholds are crossed.
 * Supports email and WhatsApp notifications.
 */

import { drizzle } from 'drizzle-orm/mysql2';
import mysql from 'mysql2/promise';
import { eq, and } from 'drizzle-orm';
import { alertRules, alertHistory, type InsertAlertHistory } from '../../drizzle/schema';
import { notifyOwner } from './notification';

export interface MetricChange {
  ticker: string;
  metricName: string;
  oldValue: string | null;
  newValue: string;
}

/**
 * Check if a metric change triggers any alert rules
 */
export async function checkAlerts(changes: MetricChange[]): Promise<void> {
  if (changes.length === 0) return;

  let connection: mysql.Connection | null = null;

  try {
    if (!process.env.DATABASE_URL) {
      console.warn('[AlertSystem] DATABASE_URL not configured');
      return;
    }

    connection = await mysql.createConnection(process.env.DATABASE_URL);
    const db = drizzle(connection);

    // Get all active alert rules
    const activeRules = await db
      .select()
      .from(alertRules)
      .where(eq(alertRules.isActive, 1));

    if (activeRules.length === 0) {
      console.log('[AlertSystem] No active alert rules');
      return;
    }

    for (const change of changes) {
      // Find matching rules for this ticker/metric
      const matchingRules = activeRules.filter(rule => 
        (rule.ticker === null || rule.ticker === change.ticker) &&
        rule.metricName === change.metricName
      );

      for (const rule of matchingRules) {
        const triggered = evaluateRule(rule, change);

        if (triggered) {
          console.log(`[AlertSystem] Alert triggered: ${rule.metricName} for ${change.ticker}`);

          // Create alert history record
          const alertRecord: InsertAlertHistory = {
            alertRuleId: rule.id,
            ticker: change.ticker,
            metricName: change.metricName,
            oldValue: change.oldValue,
            newValue: change.newValue,
            message: generateAlertMessage(rule, change),
            notificationSent: 0,
            triggeredAt: new Date(),
          };

          const [insertResult] = await db.insert(alertHistory).values(alertRecord);

          // Send notification
          const notificationSent = await sendNotification(rule, change);

          // Update notification status
          if (notificationSent && insertResult.insertId) {
            await db.update(alertHistory)
              .set({ notificationSent: 1 })
              .where(eq(alertHistory.id, insertResult.insertId));
          }
        }
      }
    }

  } catch (error: any) {
    console.error('[AlertSystem] Error checking alerts:', error.message);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

/**
 * Evaluate if a rule is triggered by a metric change
 */
function evaluateRule(rule: any, change: MetricChange): boolean {
  const newVal = parseFloat(change.newValue);
  if (isNaN(newVal)) return false;

  const threshold = parseFloat(rule.threshold);
  if (isNaN(threshold)) return false;

  switch (rule.condition) {
    case 'above':
      return newVal > threshold;
    
    case 'below':
      return newVal < threshold;
    
    case 'change':
      if (!change.oldValue) return false;
      const oldVal = parseFloat(change.oldValue);
      if (isNaN(oldVal)) return false;
      const changePercent = Math.abs(((newVal - oldVal) / oldVal) * 100);
      return changePercent >= threshold;
    
    default:
      return false;
  }
}

/**
 * Generate human-readable alert message
 */
function generateAlertMessage(rule: any, change: MetricChange): string {
  const metricLabels: Record<string, string> = {
    sharpeRatio: 'Sharpe Ratio',
    peRatio: 'KGV (PE Ratio)',
    dividendYield: 'Dividendenrendite',
    beta: 'Beta',
    volatility: 'Volatilität',
  };

  const metricLabel = metricLabels[change.metricName] || change.metricName;
  const newVal = parseFloat(change.newValue);

  switch (rule.condition) {
    case 'above':
      return `${change.ticker}: ${metricLabel} ist über ${rule.threshold} gestiegen (aktuell: ${newVal.toFixed(2)})`;
    
    case 'below':
      return `${change.ticker}: ${metricLabel} ist unter ${rule.threshold} gefallen (aktuell: ${newVal.toFixed(2)})`;
    
    case 'change':
      const oldVal = change.oldValue ? parseFloat(change.oldValue) : 0;
      const changePercent = oldVal !== 0 ? ((newVal - oldVal) / oldVal) * 100 : 0;
      return `${change.ticker}: ${metricLabel} hat sich um ${changePercent.toFixed(1)}% geändert (${oldVal.toFixed(2)} → ${newVal.toFixed(2)})`;
    
    default:
      return `${change.ticker}: ${metricLabel} Alert ausgelöst`;
  }
}

/**
 * Send notification based on rule settings
 */
async function sendNotification(rule: any, change: MetricChange): Promise<boolean> {
  const message = generateAlertMessage(rule, change);

  try {
    // For now, only email notifications via notifyOwner
    // WhatsApp can be added later using Twilio integration
    
    if (rule.notificationMethod === 'email' || rule.notificationMethod === 'both') {
      const sent = await notifyOwner({
        title: `📊 Metriken-Alert: ${change.ticker}`,
        content: message,
      });

      if (sent) {
        console.log(`[AlertSystem] Email notification sent for ${change.ticker}`);
        return true;
      }
    }

    return false;

  } catch (error: any) {
    console.error('[AlertSystem] Failed to send notification:', error.message);
    return false;
  }
}

/**
 * Create a new alert rule
 */
export async function createAlertRule(rule: {
  userId: number;
  ticker?: string;
  metricName: string;
  condition: 'above' | 'below' | 'change';
  threshold: string;
  notificationMethod?: 'email' | 'whatsapp' | 'both';
}) {
  let connection: mysql.Connection | null = null;

  try {
    if (!process.env.DATABASE_URL) {
      throw new Error('DATABASE_URL not configured');
    }

    connection = await mysql.createConnection(process.env.DATABASE_URL);
    const db = drizzle(connection);

    const [result] = await db.insert(alertRules).values({
      userId: rule.userId,
      ticker: rule.ticker || null,
      metricName: rule.metricName,
      condition: rule.condition,
      threshold: rule.threshold,
      notificationMethod: rule.notificationMethod || 'email',
      isActive: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    return result.insertId;

  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

/**
 * Get all alert rules for a user
 */
export async function getUserAlertRules(userId: number) {
  let connection: mysql.Connection | null = null;

  try {
    if (!process.env.DATABASE_URL) {
      throw new Error('DATABASE_URL not configured');
    }

    connection = await mysql.createConnection(process.env.DATABASE_URL);
    const db = drizzle(connection);

    const rules = await db
      .select()
      .from(alertRules)
      .where(eq(alertRules.userId, userId));

    return rules;

  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

/**
 * Get alert history for a user
 */
export async function getUserAlertHistory(userId: number, limit: number = 50) {
  let connection: mysql.Connection | null = null;

  try {
    if (!process.env.DATABASE_URL) {
      throw new Error('DATABASE_URL not configured');
    }

    connection = await mysql.createConnection(process.env.DATABASE_URL);
    const db = drizzle(connection);

    // Join with alertRules to filter by userId
    const { desc } = await import('drizzle-orm');
    
    const history = await db
      .select({
        id: alertHistory.id,
        ticker: alertHistory.ticker,
        metricName: alertHistory.metricName,
        oldValue: alertHistory.oldValue,
        newValue: alertHistory.newValue,
        message: alertHistory.message,
        notificationSent: alertHistory.notificationSent,
        triggeredAt: alertHistory.triggeredAt,
      })
      .from(alertHistory)
      .innerJoin(alertRules, eq(alertHistory.alertRuleId, alertRules.id))
      .where(eq(alertRules.userId, userId))
      .orderBy(desc(alertHistory.triggeredAt))
      .limit(limit);

    return history;

  } finally {
    if (connection) {
      await connection.end();
    }
  }
}
