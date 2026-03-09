/**
 * useOrderParser.js
 * Smart Voice Waiter — Parses transcripts into order OPERATIONS.
 * Supports: add, modify, delete intents + unavailable item detection.
 *
 * Backend returns: { actions: [{op, name, qty, menu_item_id, price}], unavailable: [...] }
 */
import { useState, useCallback } from 'react';
import { API_PATHS } from '../config/groqConfig';
import { localParse } from '../utils/localOrderParser';
import { MENU_ALIASES } from '../config/menuAliases';

export function useOrderParser({ menuItems = [], customerToken }) {
  const [isParsingOrder, setIsParsingOrder] = useState(false);
  const [parseMethod, setParseMethod] = useState(null);
  const [parseError, setParseError] = useState(null);

  /**
   * Parse transcript with current order context.
   * Returns: { actions: [...], unavailable: [...] }
   */
  const parse = useCallback(async (transcript, currentOrder = []) => {
    if (!transcript?.trim()) return { actions: [], unavailable: [] };

    setIsParsingOrder(true);
    setParseError(null);

    // ── Try Sarvam/Groq LLM via backend ─────────────────────────────
    try {
      const formData = new FormData();
      formData.append('transcript', transcript.trim());
      formData.append('current_order', JSON.stringify(currentOrder));

      const headers = {};
      if (customerToken) headers['Authorization'] = `Bearer ${customerToken}`;

      const res = await fetch(API_PATHS.PARSE_ORDER, {
        method: 'POST',
        headers,
        body: formData,
      });

      if (!res.ok) {
        throw new Error(`Parse-order HTTP ${res.status}`);
      }

      const data = await res.json();
      setParseMethod('sarvam');

      // Handle both new format (actions) and old format (items)
      if (data.actions) {
        return {
          actions: data.actions || [],
          unavailable: data.unavailable || [],
        };
      }

      // Backward compatibility: old format with items array
      if (data.items && data.items.length > 0) {
        const actions = data.items.map(item => ({
          op: 'add',
          name: item.name,
          qty: item.qty,
          menu_item_id: item.menu_item_id,
          price: item.price,
        }));
        return { actions, unavailable: [] };
      }

      return { actions: [], unavailable: [] };
    } catch (err) {
      console.warn('[OrderParser] LLM failed, falling back to local parser:', err.message);
      setParseError(err.message);

      // ── Local fallback (add-only) ─────────────────────────────────
      const flatMenu = menuItems.map((m) => ({
        name: m.name,
        menu_item_id: m.id,
        price: m.price,
      }));
      const localResult = localParse(transcript, flatMenu, MENU_ALIASES);
      setParseMethod('local');

      // Convert local results to action format
      const actions = localResult.map(item => ({
        op: 'add',
        name: item.name,
        qty: item.qty,
        menu_item_id: item.menu_item_id,
        price: item.price,
      }));
      return { actions, unavailable: [] };
    } finally {
      setIsParsingOrder(false);
    }
  }, [menuItems, customerToken]);

  return { parse, isParsingOrder, parseMethod, parseError };
}
