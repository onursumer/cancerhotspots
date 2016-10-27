/*
 * Copyright (c) 2016 Memorial Sloan-Kettering Cancer Center.
 *
 * This library is distributed in the hope that it will be useful, but WITHOUT
 * ANY WARRANTY, WITHOUT EVEN THE IMPLIED WARRANTY OF MERCHANTABILITY OR FITNESS
 * FOR A PARTICULAR PURPOSE. The software and documentation provided hereunder
 * is on an "as is" basis, and Memorial Sloan-Kettering Cancer Center has no
 * obligations to provide maintenance, support, updates, enhancements or
 * modifications. In no event shall Memorial Sloan-Kettering Cancer Center be
 * liable to any party for direct, indirect, special, incidental or
 * consequential damages, including lost profits, arising out of the use of this
 * software and its documentation, even if Memorial Sloan-Kettering Cancer
 * Center has been advised of the possibility of such damage.
 */

/*
 * This file is part of cBioPortal Cancer Hotspots.
 *
 * cBioPortal is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as
 * published by the Free Software Foundation, either version 3 of the
 * License.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */

/**
 * @author Selcuk Onur Sumer
 */
function ResidueController(residueView, dataManager)
{
    // we need to delay diagram filtering a bit
    // to prevent filtering every time in case of rapid mouse events
    var _filterDelay = 300;

    // we need to delay highlights right after filtering
    // to avoid incorrect rendering of lollipop circles
    var _transactionDelay = 1500;

    var _filterTimer = null;
    var _highlightTimer = null;
    var _transactionTimer = null;

    function init()
    {
        $(dataManager.dispatcher).on(EventUtils.CLUSTER_RESIDUE_HIGHLIGHT, function(event, data) {
            delayedHighlight(event, data);
        });

        $(dataManager.dispatcher).on(EventUtils.CLUSTER_RESIDUE_FILTER, function(event, data) {
            dataManager.unSelectResidues();
            delayedFilter(event, data);
        });

        $(dataManager.dispatcher).on(EventUtils.CLUSTER_RESIDUE_SELECT, function(event, data) {
            // highlight the residues on the table
            highlightTable(event, data);

            var mainView = mainMutationView();

            if (mainView)
            {
                // update mutation data
                var mutationData = mainView.model.mutationData;
                mutationData.updateSelectedMutations(
                    findMutations(mutationData, data.selected),
                    {view: residueView});
            }

        });

        $(dataManager.dispatcher).on(EventUtils.CLUSTER_PDB_SELECT, function(event, data) {
            var parts = data.pdb[0].split(":");
            residueView.getMutationMapper().getController().get3dController().reset3dView(
                parts[0], parts[1]);
        });

        $(residueView.dispatcher).on(EventUtils.MUTATION_MAPPER_INIT, function(event, data) {
            initMutationMapperEvents();
        });
    }

    function initMutationMapperEvents()
    {
        function registerMainViewEvents(mainView)
        {
            var mutationData = mainView.model.mutationData;
            var mutationDataDispatcher = $(mutationData.dispatcher);

            mutationDataDispatcher.on(MutationDetailsEvents.MUTATION_HIGHLIGHT, function(event, params) {
                // this is to prevent infinite event loop
                if (params.view === residueView) {
                    return;
                }

                var residues = [];
                var mutations = mutationData.getState().highlighted;

                _.each(mutations, function(mutation) {
                    residues.push(mutation.get('residue'));
                });

                dataManager.unHighlightResidues();

                if (!_.isEmpty(residues)) {
                    dataManager.highlightResidues(residues);
                }
            });

            mutationDataDispatcher.on(MutationDetailsEvents.MUTATION_SELECT, function(event, params) {
                // this is to prevent infinite event loop
                if (params.view === residueView) {
                    return;
                }

                var residues = [];
                var mutations = mutationData.getState().selected;

                _.each(mutations, function(mutation) {
                    residues.push(mutation.get('residue'));
                });

                dataManager.unSelectResidues();

                if (!_.isEmpty(residues)) {
                    dataManager.selectResidues(residues);
                }
            });
        }

        // wait for the main view to init
        var mainView = mainMutationView();

        if (!mainView)
        {
            var mutationDetailsView = residueView.getMutationMapper().getView();

            mutationDetailsView.dispatcher.on(MutationDetailsEvents.MAIN_VIEW_INIT, function(mainView) {
                registerMainViewEvents(mainView);
            });
        }
        else {
            registerMainViewEvents(mainView);
        }
    }

    function delayedHighlight(event, data, delay)
    {
        if (delay == null)
        {
            delay = _transactionDelay;
        }

        // clear only highlight timer
        if (_highlightTimer != null)
        {
            clearTimeout(_highlightTimer);
            _highlightTimer = null;
        }

        highlightTable(event, data);

        if (_filterTimer || _transactionTimer)
        {
            // set new timer
            _highlightTimer = setTimeout(function() {
                updateHighlightData(event, data);
                _highlightTimer = null;
            }, delay);
        }
        else
        {
            updateHighlightData(event, data);
        }
    }

    function highlightTable(event, data)
    {
        // clear all residue highlights
        residueView.unHighlightResidue();

        // highlight mutations corresponding to each residue
        _.each(data.highlighted, function (residue) {
            residueView.highlightResidue(residue);
        });

        // selected mutations should always remain highlighted!
        _.each(data.selected, function (residue) {
            residueView.highlightResidue(residue);
        });
    }

    function updateHighlightData(event, data)
    {
        var mainView = mainMutationView();

        if (mainView)
        {
            var mutationData = mainView.model.mutationData;

            // highlight mutations corresponding to each residue
            mutationData.updateHighlightedMutations(
                findMutations(mutationData, data.highlighted),
                {view: residueView});
        }
    }

    function delayedFilter(event, data, delay)
    {
        if (delay == null)
        {
            delay = _filterDelay;
        }

        // clear previous timers
        clearTimers();

        // set new timer
        _filterTimer = setTimeout(function() {
            updateFilterData(event, data);
            _transactionTimer = setTimeout(function() {
                _transactionTimer = null;
            }, _transactionDelay);
            _filterTimer = null;
        }, delay);
    }

    function updateFilterData(event, data)
    {
        var mainView = mainMutationView();

        if (mainView)
        {
            var mutationData = mainView.model.mutationData;

            if (_.isEmpty(data.filtered))
            {
                mutationData.unfilterMutations();
            }
            else
            {
                // filter mutations corresponding to each residue
                mutationData.updateFilteredMutations(
                    findMutations(mutationData, data.filtered));
            }
        }
    }

	/**
     * Filters mutations by residue within the given target array.
     *
     * @param mutationData  MutationData instance
     * @param target        target array of Mutations
     * @returns {Array}     filtered mutations
     */
    function findMutations(mutationData, target)
    {
        var mutations = [];

        _.each(target, function(residue) {
            mutations = mutations.concat(
                _.filter(mutationData.getData(), function(mutation){
                    return mutation.get("residue") === residue;
                })
            );
        });

        return mutations;
    }

    function clearTimers()
    {
        if (_filterTimer != null)
        {
            clearTimeout(_filterTimer);
            _filterTimer = null;
        }

        if (_highlightTimer != null)
        {
            clearTimeout(_highlightTimer);
            _highlightTimer = null;
        }

        if (_transactionTimer != null)
        {
            clearTimeout(_transactionTimer);
            _transactionTimer = null;
        }
    }

    function mainMutationView()
    {
        var gene = dataManager.getData().gene;

        return residueView.getMutationMapper().getController()
            .getMainView(gene).mainMutationView;
    }

    this.init = init;
}
