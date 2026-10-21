package com.acme.usermark.application.account;

import java.util.List;

/**
 * The change an administrator applies to an account. A null field stays
 * untouched, the use case decides what a change means.
 */
public record UpdateAccountCommand(List<String> roles, Boolean enabled, String ifMatch) {}
