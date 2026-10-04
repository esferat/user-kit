package com.acme.usermark.user;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping(path = "/api/v1/me", produces = MediaType.APPLICATION_JSON_VALUE)
@Tag(name = "Profile", description = "The authenticated profile")
public class MeController {

    private final AuthenticatedUserService userService;

    public MeController(AuthenticatedUserService userService) {
        this.userService = userService;
    }

    @GetMapping
    @Operation(summary = "Returns the profile of the current access token")
    public MeResponse me() {
        UserAccount account = userService.currentUser();
        return new MeResponse(
                account.getId(),
                account.getSubject(),
                account.getEmail() == null ? "" : account.getEmail(),
                account.getDisplayName(),
                account.getRoles().stream().sorted().toList(),
                account.isEnabled());
    }

    public record MeResponse(
            java.util.UUID id,
            String subject,
            String email,
            String displayName,
            java.util.List<String> roles,
            boolean enabled) {
    }
}
