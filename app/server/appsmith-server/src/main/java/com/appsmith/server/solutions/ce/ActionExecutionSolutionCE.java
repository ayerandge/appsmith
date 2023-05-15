package com.appsmith.server.solutions.ce;

import com.appsmith.external.dtos.ExecuteActionDTO;
import com.appsmith.external.models.ActionDTO;
import com.appsmith.external.models.ActionExecutionResult;
import com.appsmith.server.domains.NewAction;
import org.springframework.http.codec.multipart.Part;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

import java.util.Map;

public interface ActionExecutionSolutionCE {
    Mono<ActionExecutionResult> executeAction(Flux<Part> partFlux, String branchName, String environmentId);

    Mono<ActionExecutionResult> executeAction(ExecuteActionDTO executeActionDTO, String environmentId);

    <T> T variableSubstitution(T configuration, Map<String, String> replaceParamsMap);

}