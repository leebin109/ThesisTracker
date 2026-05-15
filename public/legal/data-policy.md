# ThesisTrack Data Policy

Last updated: 2026-05-15

This document explains how ThesisTrack separates Personal mode from Commercial-Safe mode.

## 1. Personal Mode

Personal mode may use sources intended for individual convenience, including Yahoo Finance, FMP, Alpha Vantage, or news-style sources when configured by the user.

These sources may be suitable only for personal use or may require separate review before commercial use. They are treated as Personal-only unless their terms are verified for the intended use.

## 2. Commercial-Safe Mode

Commercial-Safe mode blocks sources whose terms are unclear, non-commercial, contract-required, or otherwise not verified for the intended commercial use.

In Commercial-Safe mode:

- Yahoo, FMP, Alpha Vantage, and Google-like news calls are blocked
- United States company financial data is based on SEC EDGAR where available
- Korean company financial data uses OpenDART and verified endpoints where available
- If verified price data is unavailable, User Price or a verified commercial price source is required
- Unknown sources are not treated as safe

## 3. Cache and Source Metadata

Cached data is evaluated using source and license metadata. Non-safe cached data should not be mixed into Commercial-Safe scoring data.

Display data and scoring data may be separated so that a user can see context without using unsafe data in score calculations.

## 4. User Price

User Price is entered by the user. It is not market data and may be inaccurate or outdated.

The user is responsible for the accuracy and appropriateness of any user-entered price.

## 5. Confidence and Coverage

ThesisTrack may show data confidence, metric coverage, and limited metrics states.

Limited metrics means that only part of the expected data was available. A limited score should not be interpreted as a complete assessment.
