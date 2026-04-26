import React, {
  createContext,
  useContext,
  useReducer,
  ReactNode,
  useEffect,
  useMemo,
} from "react";
import {
  User,
  Trade,
  Stock,
  PortfolioItem,
  TradeType,
  MarketData,
} from "../types";
import { STARTING_BALANCE } from "../constants";

const BACKEND = "http://localhost:8000";

// FIX: Define and export PriceAlert interface to resolve import error in PriceAlertModal.tsx.
export interface PriceAlert {
  item: PortfolioItem;
  newPrice: number;
}

interface AppState {
  currentUser: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  tradeFeedback: {
    trade: Trade;
    userBeforeTrade: User;
  } | null;
  isInsightModalOpen: boolean;
  lastAnalysisTime: number | null;
  portfolioAnalysisCache: string | null;
  marketData: MarketData;
}

type Action =
  | { type: "LOGIN_SUCCESS"; payload: User }
  | { type: "LOGOUT_SUCCESS" }
  | { type: "AUTH_LOADING" }
  | { type: "AUTH_FAIL"; payload: string }
  | { type: "CLEAR_ERROR" }
  | {
      type: "TRADE_SUCCESS";
      payload: { trade: Trade; updatedUser: User; userBeforeTrade: User };
    }
  | { type: "TRADE_START" }
  | { type: "TRADE_FAIL"; payload: string }
  | { type: "COMPLETE_LESSON"; payload: { updatedUser: User } }
  | { type: "CLOSE_TRADE_FEEDBACK" }
  | { type: "UPDATE_MARKET_DATA"; payload: MarketData }
  | { type: "OPEN_INSIGHT_MODAL" }
  | { type: "CLOSE_INSIGHT_MODAL" }
  | { type: "SET_PORTFOLIO_ANALYSIS"; payload: { analysis: string } };

const initialMarketData = {} as MarketData;

const GUEST_USER: User = {
  id: "guest-id",
  name: "Investor",
  email: "guest@example.com",
  balance: STARTING_BALANCE,
  portfolio: [],
  tradeHistory: [],
  lessonProgress: [],
};

const initialState: AppState = {
  currentUser: GUEST_USER,
  isAuthenticated: true,
  isLoading: false,
  error: null,
  tradeFeedback: null,
  isInsightModalOpen: false,
  lastAnalysisTime: null,
  portfolioAnalysisCache: null,
  marketData: initialMarketData,
};

const AppContext = createContext<
  { state: AppState; dispatch: React.Dispatch<Action> } | undefined
>(undefined);

const appReducer = (state: AppState, action: Action): AppState => {
  switch (action.type) {
    case "AUTH_LOADING":
      return { ...state, isLoading: true };
    case "LOGIN_SUCCESS":
      return {
        ...state,
        isAuthenticated: true,
        currentUser: action.payload,
        error: null,
        isLoading: false,
      };
    case "LOGOUT_SUCCESS":
      return {
        ...state,
        isAuthenticated: false,
        currentUser: null,
        error: null,
        isLoading: false,
      };
    case "AUTH_FAIL":
      return {
        ...state,
        error: action.payload,
        isLoading: false,
        isAuthenticated: false,
        currentUser: null,
      };
    case "CLEAR_ERROR":
      return { ...state, error: null };
    case "TRADE_START":
      return { ...state, isLoading: true, error: null };
    case "TRADE_SUCCESS":
      return {
        ...state,
        isLoading: false,
        currentUser: action.payload.updatedUser,
        tradeFeedback: {
          trade: action.payload.trade,
          userBeforeTrade: action.payload.userBeforeTrade,
        },
      };
    case "TRADE_FAIL":
      return { ...state, isLoading: false, error: action.payload };
    case "COMPLETE_LESSON":
      return {
        ...state,
        currentUser: action.payload.updatedUser,
      };
    case "CLOSE_TRADE_FEEDBACK":
      return { ...state, tradeFeedback: null };
    case "UPDATE_MARKET_DATA":
      // Merge into existing prices — never wipe prices during SSE reconnect gaps
      return { ...state, marketData: { ...state.marketData, ...action.payload } };
    case "OPEN_INSIGHT_MODAL":
      return { ...state, isInsightModalOpen: true };
    case "CLOSE_INSIGHT_MODAL":
      return { ...state, isInsightModalOpen: false };
    case "SET_PORTFOLIO_ANALYSIS":
      return {
        ...state,
        portfolioAnalysisCache: action.payload.analysis,
        lastAnalysisTime: Date.now(),
      };
    default:
      return state;
  }
};

export const AppProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const [state, dispatch] = useReducer(appReducer, initialState);

  // Stable comma-separated symbol string — only changes when holdings change
  const portfolioSymbols = useMemo(() => {
    const syms = [
      ...new Set(
        (state.currentUser?.portfolio ?? []).map((item) => item.stock.symbol)
      ),
    ].sort();
    return syms.join(",");
  }, [state.currentUser?.portfolio]);

  // SSE stream — server pushes prices as fast as yfinance fetches them (~1.5s)
  useEffect(() => {
    if (!portfolioSymbols) return;

    const url = `${BACKEND}/api/prices/stream?symbols=${portfolioSymbols}`;
    const source = new EventSource(url);

    source.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data) as Record<
          string,
          { price: number; change: number; change_percent: number; is_mock: boolean }
        >;
        if ("error" in data) return;
        const newMarketData: MarketData = {};
        for (const [sym, info] of Object.entries(data)) {
          newMarketData[sym] = info.price;
        }
        if (Object.keys(newMarketData).length > 0) {
          dispatch({ type: "UPDATE_MARKET_DATA", payload: newMarketData });
        }
      } catch {
        // malformed event — ignore
      }
    };

    // EventSource auto-reconnects on error; nothing extra needed
    return () => source.close();
  }, [portfolioSymbols]);

  return (
    <AppContext.Provider value={{ state, dispatch }}>
      {children}
    </AppContext.Provider>
  );
};

export const useAppContext = () => {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error("useAppContext must be used within an AppProvider");
  }
  return context;
};

// Helper function to process trades (Local only, removed Firestore)
export const executeTrade = async (
  dispatch: React.Dispatch<Action>,
  currentState: AppState,
  stock: Stock,
  shares: number,
  type: TradeType,
) => {
  dispatch({ type: "TRADE_START" });

  if (!currentState.currentUser) {
    dispatch({ type: "TRADE_FAIL", payload: "User profile not found." });
    return;
  }

  const currentPrice = currentState.marketData[stock.symbol] || stock.price;
  const totalCost = currentPrice * shares;
  const userBeforeTrade = currentState.currentUser;

  let updatedUser: User;

  if (type === TradeType.BUY) {
    if (userBeforeTrade.balance < totalCost) {
      dispatch({ type: "TRADE_FAIL", payload: "Insufficient funds." });
      return;
    }

    const newBalance = userBeforeTrade.balance - totalCost;
    const existingHolding = userBeforeTrade.portfolio.find(
      (item) => item.stock.symbol === stock.symbol,
    );
    let newPortfolio: PortfolioItem[];

    if (existingHolding) {
      newPortfolio = userBeforeTrade.portfolio.map((item) => {
        if (item.stock.symbol === stock.symbol) {
          const totalShares = item.shares + shares;
          const totalValue = item.avgCost * item.shares + totalCost;
          return {
            ...item,
            stock: { ...item.stock, price: currentPrice },
            shares: totalShares,
            avgCost: totalValue / totalShares,
          };
        }
        return item;
      });
    } else {
      newPortfolio = [
        ...userBeforeTrade.portfolio,
        {
          stock: { ...stock, price: currentPrice },
          shares,
          avgCost: currentPrice,
        },
      ];
    }

    const newTrade: Trade = {
      stock: { ...stock, price: currentPrice },
      shares,
      price: currentPrice,
      type,
      timestamp: Date.now(),
    };
    updatedUser = {
      ...userBeforeTrade,
      balance: newBalance,
      portfolio: newPortfolio,
      tradeHistory: [...userBeforeTrade.tradeHistory, newTrade],
    };

    dispatch({
      type: "TRADE_SUCCESS",
      payload: { trade: newTrade, updatedUser, userBeforeTrade },
    });
    // Immediately seed marketData with the trade price so Dashboard recomputes
    // without waiting for the next SSE push
    dispatch({ type: "UPDATE_MARKET_DATA", payload: { [stock.symbol]: currentPrice } });
  } else {
    // SELL
    const existingHolding = userBeforeTrade.portfolio.find(
      (item) => item.stock.symbol === stock.symbol,
    );
    if (!existingHolding || existingHolding.shares < shares) {
      dispatch({
        type: "TRADE_FAIL",
        payload: "You don't own enough shares to sell.",
      });
      return;
    }

    const newBalance = userBeforeTrade.balance + totalCost;
    const newPortfolio = userBeforeTrade.portfolio
      .map((item) => {
        if (item.stock.symbol === stock.symbol) {
          return { ...item, shares: item.shares - shares };
        }
        return item;
      })
      .filter((item) => item.shares > 0);

    const newTrade: Trade = {
      stock: { ...stock, price: currentPrice },
      shares,
      price: currentPrice,
      type,
      timestamp: Date.now(),
    };
    updatedUser = {
      ...userBeforeTrade,
      balance: newBalance,
      portfolio: newPortfolio,
      tradeHistory: [...userBeforeTrade.tradeHistory, newTrade],
    };

    dispatch({
      type: "TRADE_SUCCESS",
      payload: { trade: newTrade, updatedUser, userBeforeTrade },
    });
    dispatch({ type: "UPDATE_MARKET_DATA", payload: { [stock.symbol]: currentPrice } });
  }
};
